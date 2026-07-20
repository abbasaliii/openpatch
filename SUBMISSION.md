# OpenPatch — submission kit

## Project overview

**Project name:** OpenPatch

**Elevator pitch:** A public feature layer for the web: one person asks Codex for the missing capability they need, Codex authors and tests a safe domain-scoped patch, and everyone else installs it without AI or an account.

**Recommended track:** Apps for Your Life

## Final public links

- Product and registry: https://openpatch-tau.vercel.app/
- Source repository: https://github.com/abbasaliii/openpatch
- Flagship no-login demo: https://openpatch-tau.vercel.app/care/
- Secondary CivicApply demo: https://openpatch-tau.vercel.app/demo/
- Chrome extension: https://openpatch-tau.vercel.app/downloads/openpatch-extension-v0.6.0.zip
- Codex authoring plugin: https://openpatch-tau.vercel.app/downloads/openpatch-codex-plugin-v0.3.0.zip
- Extension SHA-256: `728577E853298F62003C0BFD162CFFCBFFCE788DC20310198A24600ECED2646A`
- Plugin SHA-256: `02F08D07A3130F6241189F75123C616504C13970B4C973B5A6358EFAAC9C3D3E`
- Machine-readable registry: https://openpatch-tau.vercel.app/registry/index.json
- Live compatibility receipt: https://openpatch-tau.vercel.app/registry/compatibility.json
- Flagship community patch: https://openpatch-tau.vercel.app/registry/patches/metrocare-service-navigator.openpatch.json

The authoring workflow is technical, but the product's end user is a citizen, student, patient, shopper, or worker who needs an everyday website to function. Position OpenPatch as consumer agency over shared digital infrastructure.

## Equal-weight judging strategy

| Criterion | Evidence judges can see | Demo moment |
| --- | --- | --- |
| Technological Implementation | GPT‑5.6/Codex authoring workflow, eight-operation typed DSL, trusted filter builder, fail-closed validator, privacy-safe Repair Brief, automatic registry discovery, SHA-bound Compatibility Sentinel, drift quarantine, per-operation health, and network-silence tests | Show `collectionFilter`, then flash the 10/10 live fingerprint, 8/8 assertions, six-hour workflow, and 38/38 safety tests |
| Design | Coherent extension-to-Codex-to-registry flow, plain-language permissions, polished navigator UI, native controls, ARIA result announcements, keyboard shortcut, mobile layout, and a credible unpatched state | Select wheelchair access + Urdu + accepting new patients and watch twelve services become one understandable choice |
| Potential Impact | Government, education, health, marketplace, and legacy-tool workflows; AI cost is paid once by the author while every downstream user needs no AI, account, or API key | A person expresses a real combination of access needs the original healthcare directory never supported |
| Quality of the Idea | A public functional feature layer—not a theme editor and not an arbitrary userscript marketplace—with reusable patches and breakage receipts | End on “When a site won’t add it, users still can.” |

The tie-breaker starts with Technological Implementation, so the video should show the real Codex workflow and test receipts—not only the polished UI.

## Description

### Inspiration

People are forced to use websites they did not choose and cannot change: government forms, university portals, healthcare directories, marketplaces, and legacy work tools. Those sites do not need to be obviously broken to fail someone. A directory can work exactly as designed and still omit the filter an access need requires. The usual answer is “wait for the owner.” OpenPatch gives users another answer.

### What it does

OpenPatch is a browser extension, a constrained transformation language, an installable Codex patch-authoring plugin, and a machine-readable public repair registry.

A user opens a page and describes the capability they need to Codex. Codex inspects the live DOM and screenshots, maps the request to safe built-in operations, validates every selector and permission, and runs browser behavior tests. The resulting versioned patch runs only on its declared host and paths. The Compatibility Sentinel then opens every published target in Chromium every six hours, binds its structural fingerprint to the exact patch SHA, and quarantines drifted or unreachable entries. For everyone else, the extension automatically finds a healthy matching registry entry, pins its download to the trusted origin, independently validates policy and scope, verifies its SHA-256 receipt, preflights every selector again on the current tab, and requests Chrome access only for the declared domains. No AI, account, or API key is needed to install it.

If no patch exists, the extension creates a privacy-safe Repair Brief that the user pastes into Codex. The brief includes only structural signals and bounded selector candidates—never field values, cookies, storage, query strings, or page text.

Our flagship MetroCare demo starts with a realistic healthcare directory: twelve legitimate service cards, but no way to combine access, language, availability, and type-of-care needs. A ten-operation patch adds a trusted service navigator, native accessible controls, ARIA live result counts, `/` and Escape shortcuts, locally expiring preferences, and mobile refinements. Choosing wheelchair access + Urdu + accepting new patients yields one matching clinic. The interaction emits zero network requests. CivicApply remains as a second verified patch for form persistence, accessibility, and mobile repair.

### How we built it

- Manifest V3 Chrome extension with a polished permission and health receipt
- Automatic public-registry discovery plus safe manual import, exact-domain Chrome permissions, SHA-256 verification, live selector preflight, local versioning, and fail-closed runtime registration
- TypeScript transformation DSL and runtime
- Fail-closed security validator with CSS, attribute, selector, scope, and capability allowlists
- Trusted collection-filter runtime that reads only declared `data-*` attributes and accepts no patch-authored HTML or event code
- Official `.agents/skills` `$openpatch-author` workflow plus a distributable Codex plugin
- Generated `/registry/index.json` with versioned downloads, SHA-256 receipts, and quarantine-aware compatibility metadata
- Public `/registry/compatibility.json` plus a six-hour Chromium workflow that checks every patch against its deployed target and records per-operation fingerprints
- JSDOM unit tests plus Playwright desktop and 390px before/after tests
- Vite landing page, realistic MetroCare missing-feature demo, and CivicApply repair demo

GPT‑5.6 operates through Codex while a patch is authored and tested. The installed extension contains no model call and needs no OpenAI API key.

### Challenges

The hardest constraint was making repairs powerful enough to add a missing feature without turning the product into an arbitrary-code marketplace. `collectionFilter` does not accept HTML, JavaScript, callbacks, or network URLs. It can read only named `data-*` attributes from an exact collection, builds native controls inside trusted runtime code, caps its item count, announces results accessibly, and expires local preferences.

Responsive testing also exposed a subtle issue: device emulation can clamp document measurements even when a fixed-width application shell is visibly broken. We changed the test to assert the offending element's geometry directly and kept a strict post-patch viewport-fit assertion.

### Accomplishments

- 10/10 flagship feature operations and 8/8 publishing assertions healthy
- 19/19 CivicApply repair operations and 10/10 assertions remain healthy
- 38/38 security, registry-discovery, compatibility-quarantine, preflight, runtime, and privacy tests passing
- 4/4 Manifest V3 extension integration tests passing, including both real public demo domains
- 14/14 desktop and 390px browser journeys passing, including the instant judge preview and interactive quarantine console
- Browser proof that filter interactions emit zero network requests
- A working no-account, no-API-key extension flow
- A validated Codex skill that turns complaints into test-gated patches

### What we learned

The safest repair is the smallest operation that makes an acceptance criterion observable. Selector health is not merely test output; it is a product feature that tells a community when the original site changed. And for accessibility work, “looks fixed” is insufficient—keyboard focus and ARIA relationships must be asserted.

### What's next

Publisher signing and moderation, automated revocation propagation, community review, and additional built-ins such as task-focused reading modes and accessible table transformations.

## Judge testing instructions

1. Open https://openpatch-tau.vercel.app/care/ and observe twelve service cards with no search or filters.
2. Choose **Preview OpenPatch instantly**. The button reports `10/10 healthy` and reveals the exact constrained runtime with no install.
3. Choose **Wheelchair access**, **Urdu**, and **Accepting new patients**; observe Harbor Family Clinic and the live `1 of 12 services match` announcement.
4. To verify distribution, download https://openpatch-tau.vercel.app/downloads/openpatch-extension-v0.6.0.zip.
5. Unzip it, open `chrome://extensions`, enable Developer mode, and load the folder unpacked.
6. Reload the original MetroCare page and open the extension. It automatically discovers the verified registry patch, shows its scheduled `10/10` Compatibility Sentinel receipt, confirms its SHA-256, and independently preflights `10/10` targets on the current tab.
7. Choose **Install verified community feature**, then repeat the filters, reload to see preferences restored on-device, and press `/` to focus search.
8. For the second proof, open `/demo/` and enable CivicApply to test draft restoration and accessible validation.

No credentials or API key are needed.

## 2:45 demo video script

**0:00–0:15 — Hook**

“A website does not have to be broken to fail you. Sometimes the feature you need simply does not exist—and the software that matters most is software you cannot change. OpenPatch is the public feature layer for the web.”

**0:15–0:48 — Show the pain**

Open MetroCare. Show twelve services and the line explaining that the original portal requires people to inspect every card. Ask a concrete question: “Which clinic is wheelchair accessible, supports Urdu, and accepts new patients?” There is no way to answer it in the original interface.

**0:48–1:25 — Authoring with Codex**

On a page without a repair, type the request in the extension and choose **Copy Codex repair brief**. Flash the privacy receipt, paste the brief into Codex, then show `$openpatch-author`, DOM/screenshot inspection, and `collectionFilter`. Say: “GPT‑5.6 through Codex can add a real feature, but the patch can read only declared `data-*` attributes. It cannot contain script, HTML, fetch, cookies, or page-text extraction.” Flash: policy passed, 10/10 operations, 8/8 assertions, SHA-256 receipt.

**1:25–2:08 — Visible repair**

First click **Preview OpenPatch instantly** so judges see the feature without setup and the `10/10 healthy` receipt. Then open the extension popup and point out exact-domain scope, policy check, capabilities, and selector health. Select wheelchair access, Urdu, and accepting new patients: twelve cards become one. Reload to prove preferences stay local, press `/` to focus search, and say: “Our browser test proves these interactions make zero network requests.”

**2:08–2:32 — Community loop**

Show the registry with two repairs and open the machine-readable Compatibility Sentinel receipt: both deployed pages healthy, every operation fingerprinted. Explain that it runs every six hours and quarantines drifted entries. Then open MetroCare and the extension: the matching patch appears automatically with both the scheduled 10/10 receipt and a fresh on-device 10/10 preflight. Install it in one click. “The AI is needed once when a feature is authored. Everyone else gets it without AI, an account, or an API key.”

**2:32–2:45 — Close**

“When a site will not add the feature people need, users still can. OpenPatch gives communities agency over the software they are forced to use. Fix the web you have.”

## Submission checklist

- [x] Deploy the landing page, MetroCare flagship, and CivicApply demo to a stable public URL
- [x] Upload `release/openpatch-extension-v0.6.0.zip` and `release/openpatch-codex-plugin-v0.3.0.zip` to a stable public download
- [x] Attach the validated Codex plugin package and mention the repo-discovered skill path
- [x] Make the repository public under the MIT license, or share private access with the required judge accounts
- [ ] Add repository URL to Devpost
- [ ] Record and upload a public YouTube video under 3 minutes
- [ ] Add YouTube URL to Devpost
- [ ] Run `/feedback` in the primary Codex build thread and add the Session ID
- [x] Add the public demo URL and exact no-login testing instructions
- [x] Prepare project thumbnail and same-viewport MetroCare before/after screenshots in `submission-assets`
- [ ] Complete all five Devpost steps and submit before July 21, 2026 at 5:00 PM Pacific
