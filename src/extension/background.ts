const PATCH_ID = "org.openpatch.civicapply-accessible-draft";

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["enabledPatches", "registryMeta"]);
  await chrome.storage.local.set({
    enabledPatches: stored.enabledPatches ?? { [PATCH_ID]: false },
    registryMeta: stored.registryMeta ?? {
      lastSync: Date.now(),
      patches: 1,
      channel: "bundled-demo"
    }
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#0b9a6d" });
  await chrome.action.setBadgeText({ text: "1" });
});
