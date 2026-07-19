import { patchMatchesUrl } from "../core/matcher";
import { preflightPatchOnDocument, type SelectorPreflightResult } from "../core/preflight";
import { comparePatchVersions, permissionOrigins } from "../core/registry";
import type { OpenPatch, PatchHealth } from "../core/types";
import { validatePatch } from "../core/validator";
import { buildRepairBrief, collectPageInventory } from "./repair-brief";

type MatchedPatchState = {
  enabled: boolean;
  health: PatchHealth | null;
  source: "bundled" | "local";
  patch: Pick<OpenPatch, "id" | "name" | "summary" | "version" | "capabilities" | "author" | "match"> & { operationCount: number };
};

type PageState = {
  matched: boolean;
  matches: MatchedPatchState[];
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const host = byId<HTMLElement>("site-host");
const icon = byId<HTMLElement>("site-icon");
const matchDot = byId<HTMLElement>("match-dot");
const card = byId<HTMLElement>("patch-card");
const empty = byId<HTMLElement>("empty-state");
const toggle = byId<HTMLInputElement>("patch-toggle");
const authorButton = byId<HTMLButtonElement>("author-button");
const complaint = byId<HTMLTextAreaElement>("repair-complaint");
const briefStatus = byId<HTMLElement>("brief-status");
const patchFile = byId<HTMLInputElement>("patch-file");
const importPreview = byId<HTMLElement>("import-preview");
const importStatus = byId<HTMLElement>("import-status");
const installButton = byId<HTMLButtonElement>("install-button");

let currentTab: chrome.tabs.Tab | undefined;
let currentPatch: MatchedPatchState | undefined;
let pendingImport: { patch: OpenPatch; hash: string; preflight: SelectorPreflightResult } | undefined;

const CAPABILITY_LABELS: Record<string, string> = {
  layout: "Change allowlisted layout and visual properties",
  accessibility: "Add ARIA and safe interaction attributes",
  "local-storage": "Store bounded non-sensitive preferences or form drafts on this device",
  "keyboard-navigation": "Add arrow-key navigation within matched controls",
  validation: "Add local, accessible field validation",
  "content-filter": "Filter existing items using only declared data attributes",
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
  if (selected.enabled && selected.health) {
    byId("health-title").textContent = `${selected.health.healthy}/${selected.health.total} operations healthy`;
    byId("health-detail").textContent = selected.health.applied
      ? "All selectors matched · patch applied safely"
      : "Some selectors changed · repair needs review";
    byId("health-row").classList.toggle("warning", !selected.health.applied);
  }
}

async function sha256(raw: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function showImportPreview(patch: OpenPatch, hash: string, preflight: SelectorPreflightResult) {
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

authorButton.addEventListener("click", async () => {
  const request = complaint.value.trim();
  if (request.length < 12) {
    briefStatus.textContent = "Add a little more detail about what is broken.";
    complaint.focus();
    return;
  }
  if (!currentTab?.id || !currentTab.url?.startsWith("http")) {
    briefStatus.textContent = "Open a normal website tab, then try again.";
    return;
  }
  authorButton.disabled = true;
  briefStatus.textContent = "Inspecting page structure…";
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: collectPageInventory });
    const inventory = results[0]?.result;
    if (!inventory) throw new Error("No page inventory returned");
    await navigator.clipboard.writeText(buildRepairBrief(request, inventory));
    briefStatus.textContent = "Repair brief copied — paste it into Codex.";
  } catch {
    briefStatus.textContent = "This page blocks inspection. Try another website tab.";
  } finally {
    authorButton.disabled = false;
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
    const raw = await file.text();
    const parsed = JSON.parse(raw) as unknown;
    const validation = validatePatch(parsed);
    if (!validation.ok) {
      importStatus.textContent = `Blocked by policy: ${validation.issues[0]?.path} ${validation.issues[0]?.message}`;
      return;
    }
    if (currentPatch?.patch.id === validation.patch.id && comparePatchVersions(validation.patch.version, currentPatch.patch.version) < 0) {
      throw new Error(`Version ${validation.patch.version} is older than the installed v${currentPatch.patch.version}.`);
    }
    if (!currentTab?.id || !currentTab.url?.startsWith("http")) throw new Error("Open the website this patch repairs first.");
    const pageUrl = new URL(currentTab.url);
    if (!patchMatchesUrl(validation.patch, pageUrl)) throw new Error("This patch does not match the current domain and path.");
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: preflightPatchOnDocument,
      args: [validation.patch]
    });
    const preflight = results[0]?.result as SelectorPreflightResult | undefined;
    if (!preflight) throw new Error("Selector preflight did not return a result.");
    const hash = await sha256(raw);
    pendingImport = { patch: validation.patch, hash, preflight };
    showImportPreview(validation.patch, hash, preflight);
    importStatus.textContent = preflight.healthy === preflight.total
      ? "Policy passed. Review the receipt, then install."
      : "Blocked: one or more selectors no longer match this page.";
  } catch (error) {
    importStatus.textContent = `Blocked: ${error instanceof Error ? error.message : "invalid patch file"}`;
  }
});

installButton.addEventListener("click", async () => {
  if (!pendingImport || pendingImport.preflight.healthy !== pendingImport.preflight.total || !currentTab?.id) return;
  installButton.disabled = true;
  importStatus.textContent = "Waiting for exact-domain permission…";
  try {
    const origins = permissionOrigins(pendingImport.patch);
    const granted = await chrome.permissions.request({ origins });
    if (!granted) {
      importStatus.textContent = "Installation cancelled — no website access was granted.";
      installButton.disabled = false;
      return;
    }
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches"]);
    const installedPatches = (stored.installedPatches as Record<string, OpenPatch> | undefined) ?? {};
    const installedPatchMeta = (stored.installedPatchMeta as Record<string, unknown> | undefined) ?? {};
    const enabledPatches = (stored.enabledPatches as Record<string, boolean> | undefined) ?? {};
    installedPatches[pendingImport.patch.id] = pendingImport.patch;
    installedPatchMeta[pendingImport.patch.id] = { sha256: pendingImport.hash, installedAt: Date.now(), source: "local-file" };
    enabledPatches[pendingImport.patch.id] = true;
    await chrome.storage.local.set({ installedPatches, installedPatchMeta, enabledPatches });
    const refreshed = await chrome.runtime.sendMessage({ type: "OPENPATCH_REFRESH_RUNTIME" }) as { ok?: boolean; error?: string } | undefined;
    if (!refreshed?.ok) throw new Error(refreshed?.error ?? "Could not register the repair runtime.");
    importStatus.textContent = "Installed safely. Reloading this page…";
    await chrome.tabs.reload(currentTab.id);
    window.close();
  } catch (error) {
    importStatus.textContent = `Installation failed: ${error instanceof Error ? error.message : "unknown error"}`;
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
    const state = await chrome.tabs.sendMessage(currentTab.id, { type: "OPENPATCH_GET_STATE" }) as PageState;
    renderState(state);
  } catch {
    empty.hidden = false;
  }
}

void init();
