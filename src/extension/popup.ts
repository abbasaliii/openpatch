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

type PendingImport = {
  patch: OpenPatch;
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
const complaint = byId<HTMLTextAreaElement>("repair-complaint");
const briefStatus = byId<HTMLElement>("brief-status");
const patchFile = byId<HTMLInputElement>("patch-file");
const importPreview = byId<HTMLElement>("import-preview");
const importStatus = byId<HTMLElement>("import-status");
const installButton = byId<HTMLButtonElement>("install-button");
const installFlow = byId<HTMLElement>("install-flow");
const registryMatch = byId<HTMLElement>("registry-match");

let currentTab: chrome.tabs.Tab | undefined;
let currentPatch: MatchedPatchState | undefined;
let pendingImport: PendingImport | undefined;

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

  pendingImport = { patch, hash, preflight, source };
  showImportPreview(patch, hash, preflight);
  return { patch, preflight };
}

function showRegistryOffer(entry: RegistryPatchEntry) {
  empty.hidden = true;
  matchDot.classList.add("active");
  registryMatch.hidden = false;
  installFlow.classList.add("registry-ready");
  byId("install-eyebrow").textContent = "Public registry discovery";
  byId("install-title").textContent = "A verified feature is ready";
  byId("install-description").textContent = "OpenPatch checked its policy, SHA-256 receipt, domain scope, and live selectors on this page.";
  byId("registry-match-name").textContent = `${entry.name} · v${entry.version}`;
  const sentinelProof = entry.compatibility
    ? ` · live compatibility ${entry.compatibility.healthy}/${entry.compatibility.total}`
    : "";
  byId("registry-match-proof").textContent = `${entry.verification.operations} constrained operations · ${entry.verification.assertions} assertions${sentinelProof}`;
  byId("import-file-label").textContent = "Or choose a .openpatch.json instead";
  installButton.textContent = "Install verified community feature";
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

  showRegistryOffer(entry);
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
    const prepared = await preparePatch(await file.text(), "local-file");
    importStatus.textContent = prepared.preflight.healthy === prepared.preflight.total
      ? "Policy passed. Review the receipt, then install."
      : "Blocked: one or more selectors no longer match this page.";
  } catch (error) {
    importStatus.textContent = `Blocked: ${error instanceof Error ? error.message : "invalid patch file"}`;
  }
});

installButton.addEventListener("click", async () => {
  if (!pendingImport || pendingImport.preflight.healthy !== pendingImport.preflight.total || !currentTab?.id) return;
  const candidate = pendingImport;
  installButton.disabled = true;
  importStatus.textContent = "Waiting for exact-domain permission…";
  try {
    const origins = permissionOrigins(candidate.patch);
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
    installedPatches[candidate.patch.id] = candidate.patch;
    installedPatchMeta[candidate.patch.id] = { sha256: candidate.hash, installedAt: Date.now(), source: candidate.source };
    enabledPatches[candidate.patch.id] = true;
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
  try {
    await discoverPublicPatch();
  } catch (error) {
    if (!registryMatch.hidden) {
      importStatus.textContent = `Registry repair blocked: ${error instanceof Error ? error.message : "verification failed"}`;
    }
  }
}

void init();
