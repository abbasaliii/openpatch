import { patchMatchesUrl } from "../core/matcher";
import { preflightPatchOnDocument, type SelectorPreflightResult } from "../core/preflight";
import {
  PUBLIC_REGISTRY_URL,
  parsePublicRegistry,
  registryMatchesUrl,
  registryPatchUrl,
  type RegistryPatchEntry
} from "../core/remote-registry";
import { comparePatchVersions, permissionOrigins } from "../core/registry";
import { buildCommunityRequestUrl, inferRepairNeeds } from "../core/request-handoff";
import { archivePatch, removeHistoryEntry, restoreCandidate, type PatchHistory, type PatchHistoryEntry, type PatchInstallMeta } from "../core/patch-history";
import type { CommunityPatch, PatchHealth } from "../core/types";
import { validatePatch } from "../core/validator";
import { buildRepairBrief, collectPageInventory } from "./repair-brief";

type MatchedPatchState = {
  enabled: boolean;
  health: PatchHealth | null;
  source: "bundled" | "local";
  patch: Pick<CommunityPatch, "id" | "name" | "summary" | "version" | "capabilities" | "author" | "match"> & { operationCount: number };
};

type PageState = {
  matched: boolean;
  matches: MatchedPatchState[];
};

type PendingImport = {
  patch: CommunityPatch;
  raw: string;
  hash: string;
  preflight: SelectorPreflightResult;
  source: "local-file" | "public-registry";
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const host = byId<HTMLElement>("site-host");
const icon = byId<HTMLElement>("site-icon");
const matchDot = byId<HTMLElement>("match-dot");
const card = byId<HTMLElement>("patch-card");
const empty = byId<HTMLElement>("empty-state");
const toggle = byId<HTMLInputElement>("patch-toggle");
const authorButton = byId<HTMLButtonElement>("author-button");
const copyBriefButton = byId<HTMLButtonElement>("copy-brief");
const complaint = byId<HTMLTextAreaElement>("repair-complaint");
const briefStatus = byId<HTMLElement>("brief-status");
const patchFile = byId<HTMLInputElement>("patch-file");
const importPreview = byId<HTMLElement>("import-preview");
const importStatus = byId<HTMLElement>("import-status");
const installButton = byId<HTMLButtonElement>("install-button");
const installFlow = byId<HTMLElement>("install-flow");
const registryMatch = byId<HTMLElement>("registry-match");
const removePatchButton = byId<HTMLButtonElement>("remove-patch");
const removeStatus = byId<HTMLElement>("remove-status");
const restoreRow = byId<HTMLElement>("restore-row");
const restorePatchButton = byId<HTMLButtonElement>("restore-patch");
const restoreStatus = byId<HTMLElement>("restore-status");
const advancedImport = byId<HTMLDetailsElement>("advanced-import");
const installProgress = byId<HTMLOListElement>("install-progress");

let currentTab: chrome.tabs.Tab | undefined;
let currentPatch: MatchedPatchState | undefined;
let pendingImport: PendingImport | undefined;
let pendingRestore: PatchHistoryEntry | undefined;
let installationComplete = false;

type InstallStage = "verify" | "access" | "install" | "confirm";
const INSTALL_STAGES: InstallStage[] = ["verify", "access", "install", "confirm"];

function setInstallStage(stage: InstallStage, state: "active" | "complete" | "error") {
  installProgress.hidden = false;
  const targetIndex = INSTALL_STAGES.indexOf(stage);
  for (const [index, name] of INSTALL_STAGES.entries()) {
    const row = byId<HTMLElement>(`progress-${name}`);
    row.classList.remove("active", "complete", "error");
    if (index < targetIndex || (index === targetIndex && state === "complete")) row.classList.add("complete");
    else if (index === targetIndex) row.classList.add(state);
  }
}

async function waitForAppliedPatch(tabId: number, patchId: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const state = await chrome.tabs.sendMessage(tabId, { type: "PATCH_THE_WEB_GET_STATE" }) as PageState;
      const match = state.matches?.find((entry) => entry.patch.id === patchId);
      if (match?.enabled && match.health?.applied) return match;
    } catch {
      // The page or content runtime is still reloading.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("The repair was saved, but the page did not confirm activation. Click Retry activation.");
}

const CAPABILITY_LABELS: Record<string, string> = {
  layout: "Change allowlisted layout and visual properties",
  accessibility: "Add ARIA and safe interaction attributes",
  "local-storage": "Store bounded non-sensitive preferences or form drafts on this device",
  "keyboard-navigation": "Add arrow-key navigation within matched controls",
  validation: "Add local, accessible field validation",
  "content-filter": "Filter existing items using only declared data attributes",
  "content-compare": "Compare existing items using only declared data attributes",
  "hide-elements": "Hide explicitly matched obstructive elements",
  reorganize: "Move matched elements within the same page"
};

const CAPABILITY_CHIPS: Record<string, string> = {
  layout: "Responsive layout",
  accessibility: "Accessibility",
  "local-storage": "Local preferences",
  "keyboard-navigation": "Keyboard controls",
  validation: "Accessible errors",
  "content-filter": "Private filters",
  "content-compare": "Private comparison",
  "hide-elements": "Remove obstruction",
  reorganize: "Simplified workflow"
};

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function renderState(state: PageState) {
  if (!state.matched || state.matches.length === 0) return;
  currentPatch = state.matches.find((entry) => entry.enabled) ?? state.matches[0];
  const selected = currentPatch;
  matchDot.classList.add("active");
  card.hidden = false;
  empty.hidden = true;
  byId("patch-name").textContent = selected.patch.name;
  byId("patch-version").textContent = `v${selected.patch.version}`;
  byId("patch-summary").textContent = selected.patch.summary;
  byId("patch-author").textContent = selected.patch.author.name;
  byId("publisher-status").textContent = selected.source === "local" ? "✓ Local policy pass" : "✓ Policy checked";
  toggle.checked = selected.enabled;
  byId("toggle-title").textContent = selected.enabled ? "Repair is active" : "Apply this repair";
  byId("repair-list").replaceChildren(...selected.patch.capabilities.map((capability) => {
    const chip = document.createElement("span");
    chip.textContent = CAPABILITY_CHIPS[capability] ?? capability;
    return chip;
  }));
  byId("permissions-list").replaceChildren(
    Object.assign(document.createElement("li"), { textContent: `Runs only on ${selected.patch.match.hosts.join(", ")} ${selected.patch.match.paths.join(", ")}` }),
    ...selected.patch.capabilities.map((capability) => Object.assign(document.createElement("li"), { textContent: CAPABILITY_LABELS[capability] ?? capability }))
  );
  byId("health-detail").textContent = `${selected.patch.operationCount} constrained operations · no arbitrary JavaScript`;
  removePatchButton.hidden = selected.source !== "local";
  if (selected.enabled && selected.health) {
    byId("health-title").textContent = `${selected.health.healthy}/${selected.health.total} operations healthy`;
    byId("health-detail").textContent = selected.health.applied
      ? "All selectors matched · patch applied safely"
      : "Some selectors changed · repair needs review";
    byId("health-row").classList.toggle("warning", !selected.health.applied);
  }
}

async function loadRestoreOffer() {
  pendingRestore = undefined;
  restoreRow.hidden = true;
  restoreStatus.textContent = "";
  if (!currentPatch || currentPatch.source !== "local") return;
  const stored = await chrome.storage.local.get("patchHistory");
  const patchHistory = (stored.patchHistory as PatchHistory | undefined) ?? {};
  const candidate = restoreCandidate(patchHistory[currentPatch.patch.id], currentPatch.patch.id, currentPatch.patch.version);
  if (!candidate) return;
  pendingRestore = candidate;
  byId("restore-title").textContent = `Restore v${candidate.patch.version}`;
  byId("restore-detail").textContent = `SHA-256 ${candidate.meta.sha256.slice(0, 12)}… · saved ${new Date(candidate.archivedAt).toLocaleDateString()}`;
  restorePatchButton.textContent = `Restore v${candidate.patch.version}`;
  restoreRow.hidden = false;
}

async function sha256(raw: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function showImportPreview(patch: CommunityPatch, hash: string, preflight: SelectorPreflightResult) {
  importPreview.hidden = false;
  byId("import-name").textContent = patch.name;
  byId("import-version").textContent = `v${patch.version} · ${patch.author.name}`;
  byId("import-scope").textContent = `${patch.match.hosts.join(", ")} · ${patch.match.paths.join(", ")}`;
  byId("import-capabilities").textContent = patch.capabilities.map((capability) => CAPABILITY_CHIPS[capability] ?? capability).join(", ");
  byId("import-health").textContent = `${preflight.healthy}/${preflight.total} operation targets healthy`;
  byId("import-hash").textContent = hash;
  installButton.disabled = preflight.healthy !== preflight.total;
  importPreview.classList.toggle("warning", installButton.disabled);
}

async function preparePatch(
  raw: string,
  source: PendingImport["source"],
  registryEntry?: RegistryPatchEntry
) {
  pendingImport = undefined;
  importPreview.hidden = true;
  installButton.disabled = true;
  if (new TextEncoder().encode(raw).byteLength > 256_000) throw new Error("Patch files must be smaller than 256 KB.");

  const validation = validatePatch(JSON.parse(raw) as unknown);
  if (!validation.ok) {
    throw new Error(`Policy rejected ${validation.issues[0]?.path} ${validation.issues[0]?.message}`);
  }
  const patch = validation.patch;
  if (registryEntry && (patch.id !== registryEntry.id || patch.version !== registryEntry.version)) {
    throw new Error("Registry metadata does not match the downloaded patch.");
  }
  if (currentPatch?.patch.id === patch.id && comparePatchVersions(patch.version, currentPatch.patch.version) < 0) {
    throw new Error(`Version ${patch.version} is older than the installed v${currentPatch.patch.version}.`);
  }
  if (!currentTab?.id || !currentTab.url?.startsWith("http")) throw new Error("Open the website this patch repairs first.");
  if (!patchMatchesUrl(patch, new URL(currentTab.url))) throw new Error("This patch does not match the current domain and path.");

  const results = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: preflightPatchOnDocument,
    args: [patch]
  });
  const preflight = results[0]?.result as SelectorPreflightResult | undefined;
  if (!preflight) throw new Error("Selector preflight did not return a result.");
  const hash = await sha256(raw);
  if (registryEntry && hash !== registryEntry.sha256) throw new Error("SHA-256 integrity check failed.");

  pendingImport = { patch, raw, hash, preflight, source };
  showImportPreview(patch, hash, preflight);
  return { patch, preflight };
}

function showRegistryOffer(entry: RegistryPatchEntry, updateFrom?: string) {
  empty.hidden = true;
  matchDot.classList.add("active");
  registryMatch.hidden = false;
  advancedImport.hidden = true;
  installFlow.classList.add("registry-ready");
  byId("install-eyebrow").textContent = "Public registry discovery";
  byId("install-title").textContent = updateFrom ? `Safe update from v${updateFrom}` : "A verified feature is ready";
  byId("install-description").textContent = updateFrom
    ? "The current version stays in local history so you can restore it if the website behaves differently."
    : "Patch the Web checked its policy, SHA-256 receipt, domain scope, and live selectors on this page.";
  byId("registry-match-name").textContent = `${entry.name} · v${entry.version}`;
  const sentinelProof = entry.compatibility
    ? ` · live compatibility ${entry.compatibility.healthy}/${entry.compatibility.total}`
    : "";
  byId("registry-match-proof").textContent = `${entry.verification.operations} constrained operations · ${entry.verification.assertions} assertions${sentinelProof}`;
  installButton.textContent = updateFrom ? `Update safely to v${entry.version}` : "Install verified community feature";
}

async function discoverPublicPatch() {
  if (!currentTab?.url?.startsWith("http")) return;
  const indexResponse = await fetch(PUBLIC_REGISTRY_URL, { cache: "no-store" });
  if (!indexResponse.ok) throw new Error(`Registry returned ${indexResponse.status}.`);
  const registry = parsePublicRegistry(await indexResponse.json());
  if (!registry) throw new Error("Registry metadata failed its safety policy.");
  const candidates = registryMatchesUrl(registry, new URL(currentTab.url));
  if (candidates.length === 0) return;
  candidates.sort((left, right) => comparePatchVersions(right.version, left.version));
  const entry = candidates[0];

  if (currentPatch?.patch.id === entry.id && comparePatchVersions(currentPatch.patch.version, entry.version) >= 0) {
    byId("publisher-status").textContent = "✓ Registry verified";
    return;
  }

  const updateFrom = currentPatch?.patch.id === entry.id ? currentPatch.patch.version : undefined;
  showRegistryOffer(entry, updateFrom);
  importStatus.textContent = "Downloading the verified registry artifact…";
  const patchResponse = await fetch(registryPatchUrl(entry), { cache: "no-store" });
  if (!patchResponse.ok) throw new Error(`Patch download returned ${patchResponse.status}.`);
  const prepared = await preparePatch(await patchResponse.text(), "public-registry", entry);
  importStatus.textContent = prepared.preflight.healthy === prepared.preflight.total
    ? "Verified and healthy on this page. One click to install."
    : "Blocked: one or more selectors no longer match this page.";
}

toggle.addEventListener("change", async () => {
  if (!currentPatch) return;
  toggle.disabled = true;
  const stored = await chrome.storage.local.get("enabledPatches");
  const enabledPatches = (stored.enabledPatches as Record<string, boolean> | undefined) ?? {};
  enabledPatches[currentPatch.patch.id] = toggle.checked;
  await chrome.storage.local.set({ enabledPatches });
  if (currentTab?.id) await chrome.tabs.reload(currentTab.id);
  window.close();
});

removePatchButton.addEventListener("click", async () => {
  if (!currentPatch || currentPatch.source !== "local" || !currentTab?.id) return;
  removePatchButton.disabled = true;
  removeStatus.textContent = "Removing the patch and its local metadata…";
  try {
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches", "patchHistory"]);
    const installedPatches = (stored.installedPatches as Record<string, CommunityPatch> | undefined) ?? {};
    const installedPatchMeta = (stored.installedPatchMeta as Record<string, unknown> | undefined) ?? {};
    const enabledPatches = (stored.enabledPatches as Record<string, boolean> | undefined) ?? {};
    const patchHistory = (stored.patchHistory as PatchHistory | undefined) ?? {};
    const removed = installedPatches[currentPatch.patch.id];
    delete installedPatches[currentPatch.patch.id];
    delete installedPatchMeta[currentPatch.patch.id];
    delete enabledPatches[currentPatch.patch.id];
    delete patchHistory[currentPatch.patch.id];
    await chrome.storage.local.set({ installedPatches, installedPatchMeta, enabledPatches, patchHistory });
    const refreshed = await chrome.runtime.sendMessage({ type: "PATCH_THE_WEB_REFRESH_RUNTIME" }) as { ok?: boolean; error?: string } | undefined;
    if (!refreshed?.ok) throw new Error(refreshed?.error ?? "Could not refresh the repair runtime.");

    if (removed) {
      const originsStillNeeded = new Set(Object.values(installedPatches).flatMap((patch) => permissionOrigins(patch)));
      const unusedOrigins = permissionOrigins(removed).filter((origin) => !originsStillNeeded.has(origin));
      if (unusedOrigins.length > 0) await chrome.permissions.remove({ origins: unusedOrigins }).catch(() => false);
    }
    removeStatus.textContent = "Patch removed. Reloading this page…";
    await chrome.tabs.reload(currentTab.id);
    window.close();
  } catch (error) {
    removeStatus.textContent = `Removal failed: ${error instanceof Error ? error.message : "unknown error"}`;
    removePatchButton.disabled = false;
  }
});

restorePatchButton.addEventListener("click", async () => {
  if (!currentPatch || currentPatch.source !== "local" || !pendingRestore || !currentTab?.id || !currentTab.url) return;
  restorePatchButton.disabled = true;
  restoreStatus.textContent = `Rechecking v${pendingRestore.patch.version} on this page…`;
  try {
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches", "patchHistory"]);
    const installedPatches = (stored.installedPatches as Record<string, CommunityPatch> | undefined) ?? {};
    const installedPatchMeta = (stored.installedPatchMeta as Record<string, PatchInstallMeta> | undefined) ?? {};
    const enabledPatches = (stored.enabledPatches as Record<string, boolean> | undefined) ?? {};
    const patchHistory = (stored.patchHistory as PatchHistory | undefined) ?? {};
    const current = installedPatches[currentPatch.patch.id];
    const currentMeta = installedPatchMeta[currentPatch.patch.id];
    const candidate = restoreCandidate(patchHistory[currentPatch.patch.id], currentPatch.patch.id, currentPatch.patch.version);
    if (!current || !candidate) throw new Error("The restore point is no longer available.");
    if (await sha256(candidate.meta.sourceJson) !== candidate.meta.sha256) throw new Error("The saved SHA-256 receipt does not match.");
    const validation = validatePatch(JSON.parse(candidate.meta.sourceJson) as unknown);
    if (!validation.ok || validation.patch.id !== candidate.patch.id || validation.patch.version !== candidate.patch.version) throw new Error("The saved patch no longer passes policy validation.");
    if (!patchMatchesUrl(validation.patch, new URL(currentTab.url))) throw new Error("The saved version does not match this page.");
    const preflightResults = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: preflightPatchOnDocument, args: [validation.patch] });
    const preflight = preflightResults[0]?.result as SelectorPreflightResult | undefined;
    if (!preflight || preflight.healthy !== preflight.total) throw new Error("The saved version no longer matches every required selector.");
    const granted = await chrome.permissions.request({ origins: permissionOrigins(validation.patch) });
    if (!granted) throw new Error("Exact-domain access was not granted.");

    const remaining = removeHistoryEntry(patchHistory[currentPatch.patch.id], currentPatch.patch.id, candidate);
    patchHistory[currentPatch.patch.id] = archivePatch(remaining, current, currentMeta, Date.now());
    installedPatches[currentPatch.patch.id] = validation.patch;
    installedPatchMeta[currentPatch.patch.id] = { ...candidate.meta, installedAt: Date.now() };
    enabledPatches[currentPatch.patch.id] = true;
    await chrome.storage.local.set({ installedPatches, installedPatchMeta, enabledPatches, patchHistory });
    const refreshed = await chrome.runtime.sendMessage({ type: "PATCH_THE_WEB_REFRESH_RUNTIME" }) as { ok?: boolean; error?: string } | undefined;
    if (!refreshed?.ok) throw new Error(refreshed?.error ?? "Could not refresh the repair runtime.");

    const originsStillNeeded = new Set(Object.values(installedPatches).flatMap((patch) => permissionOrigins(patch)));
    const unusedOrigins = permissionOrigins(current).filter((origin) => !originsStillNeeded.has(origin));
    if (unusedOrigins.length > 0) await chrome.permissions.remove({ origins: unusedOrigins }).catch(() => false);
    restoreStatus.textContent = `Restored v${validation.patch.version}. Reloading…`;
    await chrome.tabs.reload(currentTab.id);
    window.close();
  } catch (error) {
    restoreStatus.textContent = `Restore blocked: ${error instanceof Error ? error.message : "unknown error"}`;
    restorePatchButton.disabled = false;
  }
});

async function inspectCurrentPage() {
  const request = complaint.value.trim();
  if (request.length < 12) {
    briefStatus.textContent = "Add a little more detail about what is broken.";
    complaint.focus();
    throw new Error("invalid-complaint");
  }
  if (!currentTab?.id || !currentTab.url?.startsWith("http")) {
    briefStatus.textContent = "Open a normal website tab, then try again.";
    throw new Error("invalid-tab");
  }
  briefStatus.textContent = "Inspecting page structure…";
  const results = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: collectPageInventory });
  const inventory = results[0]?.result;
  if (!inventory) throw new Error("No page inventory returned");
  return { request, inventory };
}

authorButton.addEventListener("click", async () => {
  authorButton.disabled = true;
  copyBriefButton.disabled = true;
  try {
    const inspected = await inspectCurrentPage();
    const needs = inferRepairNeeds(inspected.request, {
      overflowsHorizontally: inspected.inventory.viewport.overflowsHorizontally,
      fields: inspected.inventory.structure.fields,
      unlabeledFields: inspected.inventory.accessibilitySignals.unlabeledFields,
      unnamedButtons: inspected.inventory.accessibilitySignals.unnamedButtons,
      imagesMissingAlt: inspected.inventory.accessibilitySignals.imagesMissingAlt,
      possibleObstructions: inspected.inventory.possibleObstructions.length
    });
    const requestUrl = buildCommunityRequestUrl({
      target: inspected.inventory.scope,
      complaint: inspected.request,
      needs
    });
    briefStatus.textContent = "Opening your private prefilled request…";
    await chrome.tabs.create({ url: requestUrl });
    window.close();
  } catch (error) {
    if (error instanceof Error && ["invalid-complaint", "invalid-tab"].includes(error.message)) return;
    briefStatus.textContent = "This page blocks inspection. Open the blank request instead.";
  } finally {
    authorButton.disabled = false;
    copyBriefButton.disabled = false;
  }
});

copyBriefButton.addEventListener("click", async () => {
  authorButton.disabled = true;
  copyBriefButton.disabled = true;
  try {
    const inspected = await inspectCurrentPage();
    const inventory = inspected.inventory;
    await navigator.clipboard.writeText(buildRepairBrief(inspected.request, inventory));
    briefStatus.textContent = "Repair brief copied — paste it into Codex.";
  } catch (error) {
    if (error instanceof Error && ["invalid-complaint", "invalid-tab"].includes(error.message)) return;
    briefStatus.textContent = "This page blocks inspection. Try another website tab.";
  } finally {
    authorButton.disabled = false;
    copyBriefButton.disabled = false;
  }
});

patchFile.addEventListener("change", async () => {
  pendingImport = undefined;
  importPreview.hidden = true;
  installButton.disabled = true;
  const file = patchFile.files?.[0];
  if (!file) return;
  if (file.size > 256_000) {
    importStatus.textContent = "Blocked: patch files must be smaller than 256 KB.";
    return;
  }
  importStatus.textContent = "Validating policy and checking selectors…";
  try {
    const prepared = await preparePatch(await file.text(), "local-file");
    importStatus.textContent = prepared.preflight.healthy === prepared.preflight.total
      ? "Policy passed. Review the receipt, then install."
      : "Blocked: one or more selectors no longer match this page.";
  } catch (error) {
    importStatus.textContent = `Blocked: ${error instanceof Error ? error.message : "invalid patch file"}`;
  }
});

installButton.addEventListener("click", async () => {
  if (installationComplete && currentTab?.id) {
    await chrome.tabs.update(currentTab.id, { active: true });
    window.close();
    return;
  }
  if (!pendingImport || pendingImport.preflight.healthy !== pendingImport.preflight.total || !currentTab?.id) return;
  const candidate = pendingImport;
  let failedStage: InstallStage = "access";
  installButton.disabled = true;
  setInstallStage("verify", "complete");
  setInstallStage("access", "active");
  importStatus.textContent = "Chrome will ask once for access to this exact website.";
  try {
    const origins = permissionOrigins(candidate.patch);
    const alreadyGranted = await chrome.permissions.contains({ origins });
    const granted = alreadyGranted || await chrome.permissions.request({ origins });
    if (!granted) {
      setInstallStage("access", "error");
      importStatus.textContent = "Access was not granted. Nothing changed. Click again when you are ready.";
      installButton.disabled = false;
      return;
    }
    setInstallStage("access", "complete");
    setInstallStage("install", "active");
    failedStage = "install";
    importStatus.textContent = "Installing the verified repair on this device…";
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches", "patchHistory"]);
    const installedPatches = (stored.installedPatches as Record<string, CommunityPatch> | undefined) ?? {};
    const installedPatchMeta = (stored.installedPatchMeta as Record<string, PatchInstallMeta> | undefined) ?? {};
    const enabledPatches = (stored.enabledPatches as Record<string, boolean> | undefined) ?? {};
    const patchHistory = (stored.patchHistory as PatchHistory | undefined) ?? {};
    const previous = installedPatches[candidate.patch.id];
    const previousMeta = installedPatchMeta[candidate.patch.id];
    if (previous && previous.version !== candidate.patch.version) {
      patchHistory[candidate.patch.id] = archivePatch(patchHistory[candidate.patch.id], previous, previousMeta, Date.now());
    }
    installedPatches[candidate.patch.id] = candidate.patch;
    installedPatchMeta[candidate.patch.id] = { sha256: candidate.hash, installedAt: Date.now(), source: candidate.source, sourceJson: candidate.raw };
    enabledPatches[candidate.patch.id] = true;
    await chrome.storage.local.set({ installedPatches, installedPatchMeta, enabledPatches, patchHistory });
    const refreshed = await chrome.runtime.sendMessage({ type: "PATCH_THE_WEB_REFRESH_RUNTIME" }) as { ok?: boolean; error?: string } | undefined;
    if (!refreshed?.ok) throw new Error(refreshed?.error ?? "Could not register the repair runtime.");
    setInstallStage("install", "complete");
    setInstallStage("confirm", "active");
    failedStage = "confirm";
    importStatus.textContent = "Reloading once and confirming the repair…";
    await chrome.tabs.reload(currentTab.id);
    await waitForAppliedPatch(currentTab.id, candidate.patch.id);
    setInstallStage("confirm", "complete");
    importStatus.textContent = "Done — the repair is active on this page.";
    installButton.textContent = "View repaired page";
    installButton.disabled = false;
    installationComplete = true;
  } catch (error) {
    setInstallStage(failedStage, "error");
    importStatus.textContent = `Installation failed: ${error instanceof Error ? error.message : "unknown error"}`;
    installButton.textContent = "Retry activation";
    installButton.disabled = false;
  }
});

async function init() {
  currentTab = await activeTab();
  let hostname = "This page";
  try { hostname = new URL(currentTab?.url ?? "").hostname || hostname; } catch { /* use fallback */ }
  host.textContent = hostname;
  icon.textContent = hostname.charAt(0).toUpperCase();
  if (!currentTab?.id) return;
  try {
    const state = await chrome.tabs.sendMessage(currentTab.id, { type: "PATCH_THE_WEB_GET_STATE" }) as PageState;
    renderState(state);
    await loadRestoreOffer();
  } catch {
    empty.hidden = false;
  }
  try {
    await discoverPublicPatch();
  } catch (error) {
    if (!registryMatch.hidden) {
      importStatus.textContent = `Registry repair blocked: ${error instanceof Error ? error.message : "verification failed"}`;
    }
  }
}

void init();
