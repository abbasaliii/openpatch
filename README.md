# OpenPatch

**Fix the web you have.**

OpenPatch is a safe, public feature layer for websites users do not own. A user shows Codex a missing capability or inaccessible workflow and gets a constrained, domain-scoped patch. Everyone else can install that community upgrade with one click—without AI, an account, or an API key.

Built for OpenAI Build Week 2026 with Codex and GPT‑5.6.

**Live product:** [openpatch-tau.vercel.app](https://openpatch-tau.vercel.app/) · [Flagship MetroCare demo](https://openpatch-tau.vercel.app/care/) · [CivicApply repair](https://openpatch-tau.vercel.app/demo/) · [Public registry](https://openpatch-tau.vercel.app/registry/index.json) · [Compatibility Sentinel](https://openpatch-tau.vercel.app/registry/compatibility.json)

## The demo

The flagship MetroCare demo is deliberately not a broken toy. It is a credible healthcare directory that works as its owner designed it—but forces a person to inspect twelve cards to compare access, language, availability, and type of care. The site is missing the feature that person actually needs.

OpenPatch’s community patch adds a complete find-and-compare workspace using eleven declarative operations:

- Search existing services using only declared `data-*` attributes
- Combine type-of-care, access, language, and availability filters
- Reduce “wheelchair access + Urdu + accepting new patients” to one matching provider
- Select two or three providers and compare care type, access, language, and availability side by side
- Announce result counts through an ARIA live region
- Support `/` to focus search and Escape to clear
- Preserve only the user’s filter preferences locally for 24 hours
- Send no filter, page, or health data over the network
- Improve the desktop and 390px workflow without replacing the portal’s real links

The original CivicApply proof remains in the registry as a second repair. Its 19 constrained operations repair mobile layout, save non-sensitive form progress, restore drafts after a simulated reset, add accessible validation and keyboard navigation, move human help into the workflow, and remove an obstructive survey.

On any page without a community patch, the extension can also create a **privacy-safe Repair Brief** for Codex. It includes the exact origin and path, viewport geometry, structural counts, accessibility signals, and bounded selector candidates—but never field values, cookies, storage, URL queries, or page text.

OpenPatch v0.7 makes that missing-feature story substantially deeper. Its trusted `collectionCompare` primitive creates the selection controls, live status, bounded tray, and accessible comparison table itself. A patch may name only one exact collection, safe `data-*` attributes, explicit display maps, and a two-to-four item limit. It still cannot provide HTML, JavaScript, callbacks, templates, or URLs.

OpenPatch also closes the community loop and watches it after publication. Open a supported page and the extension discovers its matching repair in the public registry. Before showing the install button, it validates registry metadata and the full DSL, pins the download to the trusted registry origin, confirms the current URL is in scope, verifies the SHA-256 receipt, and preflights every operation against the live DOM. The Compatibility Sentinel opens every published target in Chromium every six hours, records an operation-by-operation structural fingerprint, and quarantines drifted or unreachable patches from discovery. A new workspace-monitor mode fingerprints local patch bytes against the live target before registry publication, so evidence never depends on trusting an already-published artifact.

![Compatibility Sentinel showing a simulated patch quarantine](submission-assets/compatibility-sentinel-quarantine.png)

The flagship validator reports **11/11 healthy operations**, **10/10 publication assertions**, and SHA-256 receipt `14cef4195ec8227fe62c16845fedc683fae1dcb4fd3a752296cef7a1bf9a936c`. Local filter preferences expire automatically after 24 hours.

![OpenPatch private service comparison](submission-assets/metrocare-compare-desktop.png)

| Before — twelve cards and no way to express a need | After — one private, accessible match |
| --- | --- |
| ![Original MetroCare directory](submission-assets/metrocare-before-desktop.png) | ![OpenPatched MetroCare service navigator](submission-assets/metrocare-after-desktop.png) |

## Why this is different

User-script tools can already inject arbitrary JavaScript. OpenPatch deliberately cannot.

```mermaid
flowchart LR
  A[User describes a broken page] --> B[Codex inspects DOM + screenshots]
  B --> C[Constrained .openpatch.json]
  C --> D[Policy validator]
  D --> E[Selector + browser tests]
  E --> F[Public patch registry]
  F --> G[One-click extension install]
  G --> H[Anyone gets the repair\nNo AI or account]
```

The patch language supports nine capabilities: bounded collection filtering, bounded collection comparison, allowlisted styles, safe attributes, explicit hiding, same-page reorganization, non-sensitive form persistence, local validation, and keyboard navigation. It has no operation for scripts, patch-authored HTML, network requests, cookies, or cross-origin data. Trusted collection features can read only explicitly declared `data-*` attributes, never page text or field values.

## Judge quick start

Requirements for the public demo: Chrome/Chromium 120+. No build, account, credential, or API key is required.

Prebuilt artifacts:

- [OpenPatch extension v0.7.0](https://openpatch-tau.vercel.app/downloads/openpatch-extension-v0.7.0.zip) — load-unpacked Chrome extension
- [OpenPatch Codex plugin v0.4.0](https://openpatch-tau.vercel.app/downloads/openpatch-codex-plugin-v0.4.0.zip) — validated authoring plugin
- Extension SHA-256: `84D5BA1FE1D947771C92097B9A930EB74D90CD4DD88AAE9990448451F7409665`
- Plugin SHA-256: `E78D5ACC07F5F4E17BE4D8E2EB37905A56BACA14E591DFBA7403BB3E4BFEDED9`

Then:

**Zero-install judge preview:** open [the live MetroCare demo](https://openpatch-tau.vercel.app/care/) and choose **Preview OpenPatch instantly**. This invokes the same constrained runtime and reports `11/11 healthy`; the steps below verify the real extension distribution path.

1. Download and unzip the public extension artifact above.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the unzipped folder.
3. Open [the live MetroCare demo](https://openpatch-tau.vercel.app/care/).
4. Observe twelve services and no search or filters—the directory works, but cannot express a person’s combined needs.
5. Open the OpenPatch extension. It discovers **MetroCare: personal service navigator**, verifies its registry receipt, shows the scheduled `11/11` live-compatibility result, and independently reports `11/11 operation targets healthy` on your current tab.
6. Choose **Install verified community feature**; the page reloads with the navigator active.
7. Select Harbor Family Clinic and Northside Community Health, then choose **Compare selected**. OpenPatch creates an accessible side-by-side decision table without sending a request.
8. Clear the comparison, choose **Wheelchair access**, **Urdu**, and **Accepting new patients**, and watch the directory reduce to Harbor Family Clinic with `1 of 12 services match`.
9. Reload to see the preferences restored locally; press `/` to focus search. The automated test proves filtering and comparison make zero network requests.

No account, test credential, API key, or external service is required.

For local development only:

```bash
npm install
npm run build
npm run dev -- --port 5173
```

### Test the Codex authoring path

1. Open any normal website tab that does not have a bundled repair.
2. Open OpenPatch and describe the problem in **Start a repair with Codex**.
3. Choose **Copy Codex repair brief**.
4. Open this repository in Codex and paste the brief. Codex auto-discovers `$openpatch-author` from `.agents/skills/openpatch-author`.

The same skill is packaged as a distributable Codex plugin under `plugins/openpatch`. The extension performs no model call; GPT‑5.6 operates through the user's existing Codex session only while a repair is authored.

![OpenPatch privacy-safe Repair Brief authoring UI](submission-assets/openpatch-repair-brief.png)

### Test community installation

1. Open the patch's target page.
2. Open OpenPatch. It fetches the machine-readable registry, selects only entries whose declared host and path match the active tab, and downloads only from the trusted registry origin.
3. Inspect the verified registry badge, capabilities, live `11/11` selector preflight, and SHA-256 receipt.
4. Choose **Install verified community feature**, approve Chrome's exact-domain prompt when required, and watch the page reload with the feature active.

For transparent/offline distribution, **Download safe patch** and manual `.openpatch.json` import still run through the same independent policy, scope, hash, and live-selector checks.

Imported patches are stored locally, run through the same constrained runtime, and can replace an older version only when their semantic version is equal or newer. Invalid stored entries are ignored rather than executed.

### Supported platforms

- Extension: Chrome/Chromium 120+ on Windows, macOS, and Linux; the release candidate is tested with Playwright Chromium.
- Authoring skill: ChatGPT desktop Codex, Codex CLI, and the Codex IDE extension on platforms that support repository skills.
- Demo and registry: any modern browser; no account, login, API key, or test data required.

## Verification

```bash
npx tsc --noEmit
npm test
npm run validate:patch
npm run test:browser
npm run test:extension
npm run monitor:registry
npm run build
# or run the entire release gate:
npm run verify
```

Current results:

- 40/40 unit, policy, registry-discovery, compatibility-quarantine, preflight, runtime, and privacy tests pass
- 14/14 desktop and 390px browser journeys pass, including the zero-install judge preview and interactive quarantine console
- 4/4 Manifest V3 extension integration tests pass with a dynamically installed patch plus both real public demo domains
- 11/11 flagship constrained operations apply; 19/19 CivicApply operations remain healthy
- 10/10 flagship publication assertions pass; 10/10 CivicApply assertions remain healthy
- Production site and Manifest V3 extension build successfully
- Public `/registry/index.json` and versioned patch download are generated with a SHA-256 receipt
- Public `/registry/compatibility.json` exposes live-page fingerprints and per-operation health; a scheduled GitHub workflow reruns it every six hours

Browser tests prove both product claims: MetroCare starts as a realistic directory with no search, filters, or comparison, then privately combines access needs, compares providers, persists preferences, announces results, supports the keyboard, fits mobile, and emits no interaction requests; CivicApply still proves layout repair, local draft restoration, specific accessible errors, and arrow-key focus movement.

## Repository map

```text
.agents/skills/openpatch-author/ Codex patch-authoring workflow, auto-discovered in this repo
.github/workflows/              Six-hour public-registry Compatibility Sentinel
plugins/openpatch/               Distributable Codex plugin package
src/core/                      DSL types, domain matcher, validator, runtime
src/extension/                 Manifest V3 content script, popup, service worker
src/registry/patches/          Versioned community patches
src/site/                      Registry landing page, MetroCare flagship, and CivicApply demo
tests/                         Security, runtime, and browser tests
scripts/                       Build, validation, and preview tooling
```

## Safe transformation DSL

Every patch declares an exact host/path scope, plain-language capabilities, constrained operations, assertions, version, and changelog.

```json
{
  "schemaVersion": 1,
  "id": "org.openpatch.civicapply-accessible-draft",
  "match": {
    "hosts": ["localhost", "127.0.0.1", "openpatch-tau.vercel.app"],
    "paths": ["/demo/*"]
  },
  "capabilities": ["local-storage", "validation"],
  "operations": [
    {
      "id": "persist-draft",
      "type": "persistForm",
      "selector": "#benefits-form",
      "key": "housing-support-draft-v1",
      "include": ["input", "select", "textarea"],
      "ttlMinutes": 1440,
      "statusText": "Draft saved on this device for 24 hours"
    }
  ]
}
```

The validator rejects unknown operations, event-handler attributes, network-capable CSS, broad document selectors, malformed scopes, undeclared capabilities, duplicate IDs, excessive operation counts, and sensitive persistence patterns. The runtime adds its own exclusions for password, file, authentication-code, payment, hidden, disabled, and submit fields.

See [`src/core/validator.ts`](src/core/validator.ts) for executable policy and [`.agents/skills/openpatch-author/references/dsl.md`](.agents/skills/openpatch-author/references/dsl.md) for the authoring reference.

## Codex collaboration

This project was created during the Build Week submission period in a single core Codex thread.

**Human product decisions:** the public repair-layer concept; the no-API-key distribution model; a deliberately constrained DSL instead of user scripts; the choice to demonstrate a public-benefits workflow; and the focus on agency, accessibility, and community reuse.

**Where GPT‑5.6 through Codex accelerated the work:** translating the concept into a judge-focused vertical slice; scaffolding the Manifest V3 extension and public registry; implementing and threat-modeling the DSL; authoring the CivicApply repair; building the privacy-safe extension-to-Codex Repair Brief; packaging the official repo skill and plugin; building unit and browser tests; running responsive visual QA; and turning browser failures into concrete layout and test-fixture fixes.

**Key joint tradeoff:** the hackathon MVP publishes two fully tested community patches instead of pretending a production-scale catalog already exists. The registry is a genuine machine-readable endpoint with versions, scopes, downloadable artifacts, operation/assertion counts, SHA-256 receipts, and live compatibility fingerprints; the extension automatically discovers the matching verified entry, rejects quarantined patches, revalidates it, preflights the current page, and installs it on its exact domains. Publisher signing, moderation, and revocation remain explicit next milestones.

The full [Build Week engineering record](BUILD_WEEK.md) maps human decisions, GPT‑5.6/Codex contributions, dated commits, iteration failures, source artifacts, and executable evidence. The project thread's `/feedback` Codex Session ID is submitted in Devpost's required private field.

## Security model

OpenPatch treats patches, websites, registry metadata, and page content as untrusted.

- Exact host and narrow path matching happens before execution.
- Registry metadata is schema-checked, downloads are same-origin pinned, and SHA-256 integrity is verified before installation.
- Scheduled Chromium checks bind every compatibility receipt to the exact patch SHA; drifted and unreachable entries are excluded from automatic discovery.
- Discovered and imported patches are policy-validated and live-selector-preflighted before Chrome requests exact-domain access.
- Operations are parsed into typed built-ins; patch code is never evaluated.
- CSS properties and attributes use allowlists.
- Critical singleton targets fail closed when selector counts drift.
- Every operation emits health data for breakage detection.
- Local draft storage stays on the page origin and excludes sensitive fields.
- Community permissions are displayed before activation.
- Patches never replace the site's actual authentication, submission, or server validation.
- Repair Briefs exclude values, cookies, storage, query strings, and page text before anything is copied to Codex.

The current MVP bundles one offline repair, automatically discovers matching verified features, and runs six-hour live compatibility checks against the public registry. Publisher signatures, moderation, automated revocation propagation, and community review are explicit next milestones.

## License

MIT. See [LICENSE](LICENSE).
