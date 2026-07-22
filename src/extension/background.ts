import civicPatchJson from "../registry/patches/civic-apply.patch-the-web.json";
import { patchMatchesUrl } from "../core/matcher";
import { buildPatchCatalog, contentScriptMatches, permissionOrigins } from "../core/registry";
import type { CommunityPatch } from "../core/types";
import { validatePatch } from "../core/validator";
import { INSTALL_SESSION_KEY, type InstallSession } from "./install-session";

const PATCH_ID = "org.patchtheweb.civicapply-accessible-draft";
const RUNTIME_SCRIPT_ID = "patch-the-web-runtime";
const bundled = [civicPatchJson as CommunityPatch];
let refreshQueue: Promise<void> = Promise.resolve();

async function refreshRuntime() {
  const stored = await chrome.storage.local.get("installedPatches");
  const catalog = buildPatchCatalog(bundled, stored.installedPatches);
  const allowed: CommunityPatch[] = [];

  for (const { patch } of catalog.patches) {
    const origins = permissionOrigins(patch);
    if (await chrome.permissions.contains({ origins })) allowed.push(patch);
  }

  await chrome.scripting.unregisterContentScripts({ ids: [RUNTIME_SCRIPT_ID] }).catch(() => undefined);
  const matches = contentScriptMatches(allowed);
  if (matches.length > 0) {
    await chrome.scripting.registerContentScripts([{
      id: RUNTIME_SCRIPT_ID,
      js: ["content.js"],
      matches,
      runAt: "document_idle",
      persistAcrossSessions: true
    }]);
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#0b9a6d" });
  await chrome.action.setBadgeText({ text: String(catalog.patches.length) });
}

function queueRuntimeRefresh() {
  refreshQueue = refreshQueue.then(refreshRuntime, refreshRuntime);
  return refreshQueue;
}

async function sha256(raw: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function waitForTabReady(tabId: number, timeoutMs = 20_000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("The target website took too long to load."));
    }, timeoutMs);
    function onUpdated(updatedId: number, change: { status?: string }) {
      if (updatedId !== tabId || change.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function startAuthorTest(message: unknown, sender: chrome.runtime.MessageSender) {
  const authorUrl = sender.tab?.url ? new URL(sender.tab.url) : undefined;
  if (sender.id !== chrome.runtime.id || authorUrl?.origin !== "https://patch-the-web.vercel.app" || authorUrl.pathname !== "/authors/") {
    throw new Error("This handoff is allowed only from the Patch the Web author workspace.");
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error("The handoff was malformed.");
  const candidate = message as { raw?: unknown; target?: unknown };
  if (typeof candidate.raw !== "string" || new TextEncoder().encode(candidate.raw).byteLength > 256_000) throw new Error("The patch file is empty or too large.");
  if (typeof candidate.target !== "string" || candidate.target.length > 2_048) throw new Error("The target page is invalid.");
  let parsed: unknown;
  try { parsed = JSON.parse(candidate.raw); } catch { throw new Error("The patch file is not valid JSON."); }
  const validation = validatePatch(parsed);
  if (!validation.ok) throw new Error(`Safety policy rejected ${validation.issues[0]?.path} ${validation.issues[0]?.message}.`);
  const target = new URL(candidate.target);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) throw new Error("Use a clean public target URL without credentials, queries, or fragments.");
  if (!patchMatchesUrl(validation.patch, target)) throw new Error("The patch scope does not include this repair request’s target page.");

  const targetTab = await chrome.tabs.create({ url: target.toString(), active: false });
  if (targetTab.id === undefined) throw new Error("Chrome could not open the target website.");
  await waitForTabReady(targetTab.id);
  const session: InstallSession = {
    raw: candidate.raw,
    hash: await sha256(candidate.raw),
    source: "local-file",
    tabId: targetTab.id,
    tabUrl: target.toString(),
    createdAt: Date.now()
  };
  await chrome.storage.session.set({ [INSTALL_SESSION_KEY]: session });
  await chrome.tabs.create({ url: chrome.runtime.getURL("install.html") });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.local.get(["enabledPatches", "installedPatches", "installedPatchMeta", "patchHistory", "registryMeta"]);
  await chrome.storage.local.set({
    enabledPatches: stored.enabledPatches ?? { [PATCH_ID]: false },
    installedPatches: stored.installedPatches ?? {},
    installedPatchMeta: stored.installedPatchMeta ?? {},
    patchHistory: stored.patchHistory ?? {},
    registryMeta: {
      ...(stored.registryMeta as Record<string, unknown> | undefined),
      lastSync: Date.now(),
      channel: "public-community",
      schemaVersion: 1
    }
  });
  await queueRuntimeRefresh();
  if (details.reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PATCH_THE_WEB_REFRESH_RUNTIME") {
    void queueRuntimeRefresh()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Runtime refresh failed" }));
    return true;
  }
  if (message?.type === "PATCH_THE_WEB_START_AUTHOR_TEST") {
    void startAuthorTest(message, _sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "The guided test could not start." }));
    return true;
  }
  return undefined;
});

void queueRuntimeRefresh();
