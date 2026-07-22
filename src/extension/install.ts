import { patchMatchesUrl } from "../core/matcher";
import { archivePatch, type PatchHistory, type PatchInstallMeta } from "../core/patch-history";
import { preflightPatchOnDocument, type SelectorPreflightResult } from "../core/preflight";
import { permissionOrigins } from "../core/registry";
import type { CommunityPatch, PatchHealth } from "../core/types";
import { validatePatch } from "../core/validator";
import { INSTALL_SESSION_KEY, isInstallSession, type InstallSession } from "./install-session";

type PageState = {
  matches?: Array<{ enabled: boolean; health: PatchHealth | null; patch: { id: string } }>;
};

type ReadyCandidate = {
  session: InstallSession;
  patch: CommunityPatch;
  preflight?: SelectorPreflightResult;
};

const CAPABILITY_LABELS: Record<string, string> = {
  layout: "Responsive layout",
  accessibility: "Accessible labels and interaction",
  "local-storage": "Private local preferences or drafts",
  "keyboard-navigation": "Keyboard navigation",
  validation: "Accessible local validation",
  "content-filter": "Private search and filters",
  "content-compare": "Private comparison",
  "hide-elements": "Remove declared obstructions",
  reorganize: "Simplified page workflow"
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const loading = byId<HTMLElement>("loading");
const receipt = byId<HTMLElement>("receipt");
const fatal = byId<HTMLElement>("fatal");
const fatalMessage = byId<HTMLElement>("fatal-message");
const status = byId<HTMLElement>("status");
const installButton = byId<HTMLButtonElement>("install");
const cancelButton = byId<HTMLButtonElement>("cancel");
let ready: ReadyCandidate | undefined;
let complete = false;
let returnTabId: number | undefined;

async function sha256(raw: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setStage(stage: "verify" | "access" | "install" | "confirm", state: "active" | "complete" | "error") {
  const names = ["verify", "access", "install", "confirm"] as const;
  const target = names.indexOf(stage);
  names.forEach((name, index) => {
    const row = byId<HTMLElement>(`stage-${name}`);
    row.classList.remove("active", "complete", "error");
    if (index < target || (index === target && state === "complete")) row.classList.add("complete");
    else if (index === target) row.classList.add(state);
  });
}

function showFatal(message: string) {
  loading.hidden = true;
  receipt.hidden = true;
  fatal.hidden = false;
  fatalMessage.textContent = message;
}

async function targetTab(tabId: number) {
  try { return await chrome.tabs.get(tabId); } catch { return undefined; }
}

async function preflightOnTab(tabId: number, patch: CommunityPatch) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: preflightPatchOnDocument,
    args: [patch]
  });
  return result[0]?.result as SelectorPreflightResult | undefined;
}

async function verifySession(session: InstallSession, requirePreflight = false): Promise<ReadyCandidate> {
  if (await sha256(session.raw) !== session.hash) throw new Error("The repair changed after verification. Start again from the website.");
  let parsed: unknown;
  try { parsed = JSON.parse(session.raw); } catch { throw new Error("The repair file is not valid JSON."); }
  const validation = validatePatch(parsed);
  if (!validation.ok) throw new Error(`Safety policy rejected ${validation.issues[0]?.path} ${validation.issues[0]?.message}.`);
  const tab = await targetTab(session.tabId);
  if (!tab?.url?.startsWith("http")) throw new Error("The original website tab was closed. Reopen it and start the installation again.");
  if (!patchMatchesUrl(validation.patch, new URL(tab.url))) throw new Error("The original tab is no longer on a page this repair is allowed to change.");
  let preflight: SelectorPreflightResult | undefined;
  try {
    preflight = await preflightOnTab(session.tabId, validation.patch);
  } catch {
    if (requirePreflight) throw new Error("The website blocked the selector check even after access was approved. Nothing was installed.");
  }
  if (requirePreflight && !preflight) throw new Error("The website did not return a selector check. Nothing was installed.");
  if (preflight && preflight.healthy !== preflight.total) throw new Error(`The website changed: ${preflight.total - preflight.healthy} of ${preflight.total} repair targets no longer match. Nothing was installed.`);
  return { session, patch: validation.patch, preflight };
}

function renderCandidate(candidate: ReadyCandidate) {
  const { patch, session, preflight } = candidate;
  const path = patch.match.paths.join(", ");
  loading.hidden = true;
  fatal.hidden = true;
  receipt.hidden = false;
  byId("source-label").textContent = session.source === "public-registry" ? "Verified public registry repair" : "Local author test repair";
  byId("repair-name").textContent = patch.name;
  byId("repair-summary").textContent = patch.summary;
  byId("repair-version").textContent = `v${patch.version}`;
  byId("repair-domain").textContent = patch.match.hosts.join(", ");
  byId("repair-path").textContent = path;
  byId("repair-capabilities").replaceChildren(...patch.capabilities.map((item) => {
    const chip = document.createElement("span");
    chip.className = "capability";
    chip.textContent = CAPABILITY_LABELS[item] ?? item;
    return chip;
  }));
  byId("repair-health").textContent = preflight
    ? `${preflight.healthy}/${preflight.total} operation targets healthy now`
    : "Runs immediately after you approve this website";
  byId("repair-hash").textContent = session.hash;
  byId("permission-domain").textContent = patch.match.hosts.join(", ");
  setStage("verify", "complete");
}

async function waitForAppliedPatch(tabId: number, patchId: string, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const state = await chrome.tabs.sendMessage(tabId, { type: "PATCH_THE_WEB_GET_STATE" }) as PageState;
      const match = state.matches?.find((entry) => entry.patch.id === patchId);
      if (match?.enabled && match.health?.applied) return;
    } catch {
      // The page runtime is still loading after the controlled reload.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("The repair was saved, but the page did not confirm activation. Keep this page open and click Retry activation.");
}

async function focusTargetAndClose() {
  const tabId = ready?.session.tabId ?? returnTabId;
  if (tabId !== undefined) await chrome.tabs.update(tabId, { active: true }).catch(() => undefined);
  const ownTab = await chrome.tabs.getCurrent();
  if (ownTab?.id) await chrome.tabs.remove(ownTab.id).catch(() => undefined);
}

installButton.addEventListener("click", async () => {
  if (complete) {
    await focusTargetAndClose();
    return;
  }
  if (!ready) return;
  installButton.disabled = true;
  cancelButton.disabled = true;
  status.classList.remove("error", "success");
  let failedStage: "access" | "install" | "confirm" = "access";
  try {
    status.textContent = "Rechecking the page before asking for access…";
    ready = await verifySession(ready.session);
    setStage("access", "active");
    status.textContent = "Chrome will now ask for access to this website only.";
    const origins = permissionOrigins(ready.patch);
    const granted = await chrome.permissions.contains({ origins }) || await chrome.permissions.request({ origins });
    if (!granted) {
      setStage("access", "error");
      status.classList.add("error");
      status.textContent = "Access was not granted. Nothing changed—you can try again or cancel safely.";
      return;
    }

    setStage("access", "complete");
    status.textContent = "Access approved. Running the live selector check before installation…";
    ready = await verifySession(ready.session, true);
    byId("repair-health").textContent = `${ready.preflight!.healthy}/${ready.preflight!.total} operation targets healthy now`;
    setStage("install", "active");
    failedStage = "install";
    status.textContent = "Installing this verified repair locally…";
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches", "patchHistory"]);
    const installedPatches = (stored.installedPatches as Record<string, CommunityPatch> | undefined) ?? {};
    const installedPatchMeta = (stored.installedPatchMeta as Record<string, PatchInstallMeta> | undefined) ?? {};
    const enabledPatches = (stored.enabledPatches as Record<string, boolean> | undefined) ?? {};
    const patchHistory = (stored.patchHistory as PatchHistory | undefined) ?? {};
    const previous = installedPatches[ready.patch.id];
    const previousMeta = installedPatchMeta[ready.patch.id];
    if (previous && previous.version !== ready.patch.version) {
      patchHistory[ready.patch.id] = archivePatch(patchHistory[ready.patch.id], previous, previousMeta, Date.now());
    }
    installedPatches[ready.patch.id] = ready.patch;
    installedPatchMeta[ready.patch.id] = {
      sha256: ready.session.hash,
      installedAt: Date.now(),
      source: ready.session.source,
      sourceJson: ready.session.raw
    };
    enabledPatches[ready.patch.id] = true;
    await chrome.storage.local.set({ installedPatches, installedPatchMeta, enabledPatches, patchHistory });
    const refreshed = await chrome.runtime.sendMessage({ type: "PATCH_THE_WEB_REFRESH_RUNTIME" }) as { ok?: boolean; error?: string } | undefined;
    if (!refreshed?.ok) throw new Error(refreshed?.error ?? "Could not register the repair runtime.");

    setStage("install", "complete");
    setStage("confirm", "active");
    failedStage = "confirm";
    status.textContent = "Reloading the original tab once and confirming the result…";
    await chrome.tabs.reload(ready.session.tabId);
    await waitForAppliedPatch(ready.session.tabId, ready.patch.id);
    await chrome.storage.session.remove(INSTALL_SESSION_KEY);
    setStage("confirm", "complete");
    status.classList.add("success");
    status.textContent = "Repair active and confirmed. You can return to the repaired website.";
    installButton.textContent = "View repaired website";
    cancelButton.hidden = true;
    complete = true;
  } catch (error) {
    setStage(failedStage, "error");
    status.classList.add("error");
    status.textContent = `Installation stopped: ${error instanceof Error ? error.message : "unknown error"}`;
    installButton.textContent = "Retry activation";
  } finally {
    installButton.disabled = false;
    cancelButton.disabled = false;
  }
});

cancelButton.addEventListener("click", async () => {
  await chrome.storage.session.remove(INSTALL_SESSION_KEY);
  await focusTargetAndClose();
});

byId("return-site").addEventListener("click", async () => focusTargetAndClose());
byId("discard").addEventListener("click", async () => {
  await chrome.storage.session.remove(INSTALL_SESSION_KEY);
  await focusTargetAndClose();
});

async function init() {
  const stored = await chrome.storage.session.get(INSTALL_SESSION_KEY);
  const session = stored[INSTALL_SESSION_KEY];
  if (session && typeof session === "object" && Number.isInteger((session as { tabId?: unknown }).tabId)) {
    returnTabId = (session as { tabId: number }).tabId;
  }
  if (!isInstallSession(session)) {
    await chrome.storage.session.remove(INSTALL_SESSION_KEY);
    showFatal("This installation attempt is missing or expired. Return to the website, open Patch the Web, and choose the repair again.");
    return;
  }
  try {
    ready = await verifySession(session);
    renderCandidate(ready);
  } catch (error) {
    showFatal(error instanceof Error ? error.message : "The repair could not be verified.");
  }
}

void init();
