# Patch the Web — submission kit

## Project overview

**Project name:** Patch the Web

**Elevator pitch:** A public feature layer for the web: one person asks Codex for the missing capability they need, Codex authors and tests a safe domain-scoped patch, and everyone else installs it without AI or an account.

**Recommended track:** Apps for Your Life

## Final public links

- Product and registry: https://patch-the-web.vercel.app/
- Source repository: https://github.com/abbasaliii/patch-the-web
- Build Week engineering record: https://github.com/abbasaliii/patch-the-web/blob/main/BUILD_WEEK.md
- Verified v0.8.0 release: https://github.com/abbasaliii/patch-the-web/releases/tag/v0.8.0
- Flagship no-login demo: https://patch-the-web.vercel.app/care/
- Secondary CivicApply demo: https://patch-the-web.vercel.app/demo/
- Chrome extension: https://patch-the-web.vercel.app/downloads/patch-the-web-extension-v0.8.0.zip
- Codex authoring plugin: https://patch-the-web.vercel.app/downloads/patch-the-web-codex-plugin-v0.4.0.zip
- Public demo video: https://youtu.be/AVjukDA786E (`submission-assets/patch-the-web-demo.mp4`, 2:56, continuous live browser recording, narrated and scene-synchronized captions)
- Devpost 3:2 cover: `submission-assets/patch-the-web-devpost-thumbnail.png`
- Extension SHA-256: `30C472E6B23E5A75BD709EA3040EEFCD62FBC35A669773D8400FDFE1E1CD4F50`
- Plugin SHA-256: `EFD9B788FBC90E6248427F2421B3239DAAF2CE398D550B01CED5390880DD06CF`
- Machine-readable registry: https://patch-the-web.vercel.app/registry/index.json
- Live compatibility receipt: https://patch-the-web.vercel.app/registry/compatibility.json
- Flagship community patch: https://patch-the-web.vercel.app/registry/patches/metrocare-service-navigator.patch-the-web.json

The authoring workflow is technical, but the product's end user is a citizen, student, patient, shopper, or worker who needs an everyday website to function. Position Patch the Web as consumer agency over shared digital infrastructure.

## Equal-weight judging strategy

**Objective accessibility evidence:** 20/20 desktop and mobile browser journeys pass, including six strict axe scans over both fully patched workflows and both public product surfaces using WCAG A/AA rule tags, with zero automated violations.

| Criterion | Evidence judges can see | Demo moment |
| --- | --- | --- |
| Technological Implementation | GPT‑5.6/Codex authoring workflow, nine-capability typed DSL, trusted filter and comparison builders, fail-closed validator, privacy-safe Repair Brief, automatic registry discovery, SHA-bound Compatibility Sentinel, drift quarantine, per-operation health, and network-silence tests | Show `collectionCompare`, then flash the 11/11 live fingerprint, 10/10 assertions, six-hour workflow, and 44/44 safety tests |
| Design | Coherent extension-to-Codex-to-registry flow, plain-language permissions, polished navigator UI, native controls, ARIA result announcements, keyboard shortcut, mobile layout, and a credible unpatched state | Select wheelchair access + Urdu + accepting new patients and watch twelve services become one understandable choice |
| Potential Impact | Government, education, health, marketplace, and legacy-tool workflows; AI cost is paid once by the author while every downstream user needs no AI, account, or API key | A person expresses a real combination of access needs the original healthcare directory never supported |
| Quality of the Idea | A public functional feature layer—not a theme editor and not an arbitrary userscript marketplace—with reusable patches and breakage receipts | End on “When a site won’t add it, users still can.” |

The tie-breaker starts with Technological Implementation, so the video should show the real Codex workflow and test receipts—not only the polished UI.

## Description

### Inspiration

People are forced to use websites they did not choose and cannot change: government forms, university portals, healthcare directories, marketplaces, and legacy work tools. Those sites do not need to be obviously broken to fail someone. A directory can work exactly as designed and still omit the filter an access need requires. The usual answer is “wait for the owner.” Patch the Web gives users another answer.

### What it does

Patch the Web is a browser extension, a constrained transformation language, an installable Codex patch-authoring plugin, and a machine-readable public repair registry.

A user opens a page and describes the capability they need to Codex. Codex inspects the live DOM and screenshots, maps the request to safe built-in operations, validates every selector and permission, and runs browser behavior tests. The resulting versioned patch runs only on its declared host and paths. The Compatibility Sentinel then opens every published target in Chromium every six hours, binds its structural fingerprint to the exact patch SHA, and quarantines drifted or unreachable entries. For everyone else, the extension automatically finds a healthy matching registry entry, pins its download to the trusted origin, independently validates policy and scope, verifies its SHA-256 receipt, preflights every selector again on the current tab, and requests Chrome access only for the declared domains. No AI, account, or API key is needed to install it.

If no patch exists, the extension creates a privacy-safe Repair Brief that the user pastes into Codex. The brief includes only structural signals and bounded selector candidates—never field values, cookies, storage, query strings, or page text.

Our flagship MetroCare demo starts with a realistic healthcare directory: twelve legitimate service cards, but no way to search, combine access needs, or compare providers. An eleven-operation patch adds a trusted service navigator and a private decision table, native accessible controls, ARIA live status, `/` and Escape shortcuts, locally expiring preferences, and mobile refinements. People can compare up to three providers, then reduce wheelchair access + Urdu + accepting new patients to one matching clinic. Filtering and comparison emit zero network requests. CivicApply remains as a second verified patch for form persistence, accessibility, and mobile repair.

### How we built it

- Manifest V3 Chrome extension with a polished permission and health receipt
- Automatic public-registry discovery plus safe manual import, exact-domain Chrome permissions, SHA-256 verification, live selector preflight, local versioning, and fail-closed runtime registration
- TypeScript transformation DSL and runtime
- Fail-closed security validator with CSS, attribute, selector, scope, and capability allowlists
- Trusted collection-filter and collection-compare runtimes that read only declared `data-*` attributes and accept no patch-authored HTML, templates, event code, or URLs
- Official `.agents/skills` `$patch-the-web-author` workflow plus a distributable Codex plugin
- Generated `/registry/index.json` with versioned downloads, SHA-256 receipts, and quarantine-aware compatibility metadata
- Public `/registry/compatibility.json` plus a six-hour Chromium workflow that checks every patch against its deployed target and records per-operation fingerprints
- JSDOM unit tests plus Playwright desktop and 390px before/after tests, including axe WCAG A/AA audits
- Vite landing page, realistic MetroCare missing-feature demo, and CivicApply repair demo

GPT‑5.6 operates through Codex while a patch is authored and tested. The installed extension contains no model call and needs no OpenAI API key.

The repository's `BUILD_WEEK.md` provides dated commit evidence and maps every major human decision and GPT‑5.6/Codex contribution to its source and executable proof. This makes the author-time AI workflow auditable without pretending the deterministic installed runtime needs a model call.

### Challenges

The hardest constraint was making repairs powerful enough to add missing product features without turning the registry into an arbitrary-code marketplace. `collectionFilter` and `collectionCompare` do not accept HTML, JavaScript, callbacks, templates, or network URLs. They can read only named `data-*` attributes from one exact collection. Trusted runtime code builds the native controls, bounds selection to two-to-four items, generates the accessible table, caps item counts, announces state, and expires local preferences.

Responsive testing also exposed a subtle issue: device emulation can clamp document measurements even when a fixed-width application shell is visibly broken. We changed the test to assert the offending element's geometry directly and kept a strict post-patch viewport-fit assertion.

### Accomplishments

- 11/11 flagship feature operations and 10/10 publishing assertions healthy
- 19/19 CivicApply repair operations and 10/10 assertions remain healthy
- 44/44 security, registry-discovery, compatibility-quarantine, preflight, runtime, and privacy tests passing
- 6/6 Manifest V3 extension integration tests passing, including both real public demo domains, removal, and the domain switch
- 20/20 desktop and 390px browser journeys passing, including six strict axe WCAG A/AA scans with zero automated violations
- Browser proof that filter and comparison interactions emit zero network requests
- A working no-account, no-API-key extension flow
- A validated Codex skill that turns complaints into test-gated patches

### What we learned

The safest repair is the smallest operation that makes an acceptance criterion observable. Selector health is not merely test output; it is a product feature that tells a community when the original site changed. And for accessibility work, “looks fixed” is insufficient—keyboard focus and ARIA relationships must be asserted.

### What's next

Publisher signing and moderation, community review, and additional built-ins such as task-focused reading modes and guided multi-step workflows.

## Judge testing instructions

1. Open https://patch-the-web.vercel.app/care/ and observe twelve service cards with no search or filters.
2. Choose **Preview Patch the Web instantly**. The button reports `11/11 healthy` and reveals the exact constrained runtime with no install.
3. Select Harbor Family Clinic and Northside Community Health, then choose **Compare selected**. Inspect the accessible private decision table.
4. Clear the comparison. Choose **Wheelchair access**, **Urdu**, and **Accepting new patients**; observe Harbor Family Clinic and the live `1 of 12 services match` announcement.
5. To verify distribution, download https://patch-the-web.vercel.app/downloads/patch-the-web-extension-v0.8.0.zip.
6. Unzip it, open `chrome://extensions`, enable Developer mode, and load the folder unpacked.
7. Reload the original MetroCare page and open the extension. It automatically discovers the verified registry patch, shows its scheduled `11/11` Compatibility Sentinel receipt, confirms its SHA-256, and independently preflights `11/11` targets on the current tab.
8. Choose **Install verified community feature**, then repeat the filters, reload to see preferences restored on-device, and press `/` to focus search.
9. For the second proof, open `/demo/` and enable CivicApply to test draft restoration and accessible validation.

No credentials or API key are needed.

## 2:56 continuous demo sequence

- **0:00–0:12 — Start at the beginning:** introduce Patch the Web on the public production site.
- **0:12–0:29 — Install the extension:** download the release and show the real v0.8.0 extension in a clean Chrome profile.
- **0:29–0:44 — Show the missing capability:** open MetroCare with twelve cards and no search, filters, or comparison.
- **0:44–1:02 — Discover a verified repair:** open the actual extension and show its registry match, policy, hash, compatibility, and live-selector checks.
- **1:02–1:41 — Install safely:** activate the domain-scoped declarative patch; no arbitrary JavaScript is accepted.
- **1:41–1:57 — Use comparison:** select two providers and open the keyboard-accessible comparison feature.
- **1:57–2:12 — Filter privately:** combine wheelchair access, Urdu, and new-patient availability until twelve cards become one.
- **2:12–2:27 — Prove persistence:** reload and show that the on-device preferences return automatically.
- **2:27–2:39 — Keep user control:** review the active repair, 11/11 health, exact-domain scope, and permissions.
- **2:39–2:56 — Explain GPT‑5.6 + Codex:** Codex accelerated DSL design, threat modeling, DOM/screenshot inspection, patch authoring, and test generation; everyone downstream installs the deterministic result without AI, an account, or an API key.

## Submission checklist

- [x] Deploy the landing page, MetroCare flagship, and CivicApply demo to a stable public URL
- [x] Upload `release/patch-the-web-extension-v0.8.0.zip` and `release/patch-the-web-codex-plugin-v0.4.0.zip` to a stable public download
- [x] Attach the validated Codex plugin package and mention the repo-discovered skill path
- [x] Make the repository public under the MIT license, or share private access with the required judge accounts
- [x] Add repository URL to Devpost
- [x] Record a narrated, captioned demo video under 3 minutes (`submission-assets/patch-the-web-demo.mp4`)
- [x] Upload the final video to public YouTube using `VIDEO_UPLOAD.md`
- [x] Save the YouTube URL in Devpost
- [x] Run `/feedback` in the primary Codex build thread and add the Session ID
- [x] Add the public demo URL and exact no-login testing instructions
- [x] Prepare project thumbnail and same-viewport MetroCare before/after screenshots in `submission-assets`
- [ ] Complete all five Devpost steps and submit before July 21, 2026 at 5:00 PM Pacific
