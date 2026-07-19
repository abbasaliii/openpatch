# OpenPatch — submission kit

## Project overview

**Project name:** OpenPatch

**Elevator pitch:** A safe public repair layer for the web—author domain-scoped fixes with Codex, then let anyone install them with one click, without AI or an account.

**Recommended track:** Apps for Your Life

## Final public links

- Product and registry: https://openpatch-tau.vercel.app/
- Source repository: https://github.com/abbasaliii/openpatch
- Live no-login demo: https://openpatch-tau.vercel.app/demo/
- Chrome extension: https://openpatch-tau.vercel.app/downloads/openpatch-extension-v0.3.0.zip
- Codex authoring plugin: https://openpatch-tau.vercel.app/downloads/openpatch-codex-plugin-v0.2.0.zip
- Machine-readable registry: https://openpatch-tau.vercel.app/registry/index.json
- Versioned community patch: https://openpatch-tau.vercel.app/registry/patches/civic-apply.openpatch.json

The authoring workflow is technical, but the product's end user is a citizen, student, patient, shopper, or worker who needs an everyday website to function. Position OpenPatch as consumer agency over shared digital infrastructure.

## Equal-weight judging strategy

| Criterion | Evidence judges can see | Demo moment |
| --- | --- | --- |
| Technological Implementation | GPT‑5.6/Codex authoring workflow, constrained typed DSL, fail-closed validator, privacy-safe Repair Brief, per-operation health, SHA-256 registry receipt, unit and browser tests | Paste the Repair Brief into Codex, show the generated patch, then flash the green validator and test receipts |
| Design | Coherent extension-to-Codex-to-registry flow, plain-language permissions, visible health, polished responsive landing page, dramatic exact-viewport before/after | Enable one repair and immediately remove overflow, obstruction, lost progress, generic errors, and broken keyboard behavior |
| Potential Impact | Government, education, health, marketplace, and legacy-tool workflows; AI cost is paid once by the author while every downstream user needs no AI, account, or API key | Lose an unfinished benefits application before the repair; restore it after the repair |
| Quality of the Idea | A public functional repair layer—not a theme editor and not an arbitrary userscript marketplace—with reusable community patches and breakage receipts | End on “When owners won’t fix it, users still can.” |

The tie-breaker starts with Technological Implementation, so the video should show the real Codex workflow and test receipts—not only the polished UI.

## Description

### Inspiration

People are forced to use websites they did not choose and cannot change: government forms, university portals, healthcare services, marketplaces, and legacy work tools. When those sites lose progress, break on mobile, or regress in accessibility, the usual answer is “wait for the owner.” OpenPatch gives users another answer.

### What it does

OpenPatch is a browser extension, a constrained transformation language, an installable Codex patch-authoring plugin, and a machine-readable public repair registry.

A user opens a broken page and describes the problem to Codex. Codex inspects the live DOM and screenshots, maps the complaint to safe built-in operations, validates every selector and permission, and runs browser behavior tests. The resulting versioned patch runs only on its declared host and paths. Other users download its `.openpatch.json`; the extension independently validates policy, checks the current URL, preflights every live selector, shows a SHA-256 permission receipt, and requests Chrome access only for the declared domains. No AI, account, or API key is needed to install it.

If no patch exists, the extension creates a privacy-safe Repair Brief that the user pastes into Codex. The brief includes only structural signals and bounded selector candidates—never field values, cookies, storage, query strings, or page text.

Our CivicApply demo repairs a public-benefits form with 19 declarative operations. It fixes the 390px layout, preserves unfinished progress locally, restores a draft after a simulated session reset, adds accessible validation and arrow-key navigation, moves help into the workflow, and removes a blocking survey.

### How we built it

- Manifest V3 Chrome extension with a polished permission and health receipt
- Safe community import with exact-domain Chrome permissions, live selector preflight, local versioning, and fail-closed runtime registration
- TypeScript transformation DSL and runtime
- Fail-closed security validator with CSS, attribute, selector, scope, and capability allowlists
- Official `.agents/skills` `$openpatch-author` workflow plus a distributable Codex plugin
- Generated `/registry/index.json` with a versioned patch download and SHA-256 receipt
- JSDOM unit tests plus Playwright desktop and 390px before/after tests
- Vite landing page and intentionally broken CivicApply test portal

GPT‑5.6 operates through Codex while a patch is authored and tested. The installed extension contains no model call and needs no OpenAI API key.

### Challenges

The hardest constraint was making repairs useful without turning the product into an arbitrary-code marketplace. We modeled every repair as a typed built-in, rejected unsafe CSS and attributes, excluded sensitive form fields at runtime, required exact scope and selector counts, and made browser tests prove user-visible behavior.

Responsive testing also exposed a subtle issue: device emulation can clamp document measurements even when a fixed-width application shell is visibly broken. We changed the test to assert the offending element's geometry directly and kept a strict post-patch viewport-fit assertion.

### Accomplishments

- 19/19 operations healthy
- 21/21 security, registry, preflight, runtime, and privacy tests passing
- 2/2 production Manifest V3 extension integration tests passing with a dynamically installed community patch and the real public demo domain
- 6/6 desktop and mobile browser tests passing
- 10/10 publishing assertions passing
- A working no-account, no-API-key extension flow
- A validated Codex skill that turns complaints into test-gated patches

### What we learned

The safest repair is the smallest operation that makes an acceptance criterion observable. Selector health is not merely test output; it is a product feature that tells a community when the original site changed. And for accessibility work, “looks fixed” is insufficient—keyboard focus and ARIA relationships must be asserted.

### What's next

Publisher signing and moderation, automatic remote registry discovery and revocation, scheduled breakage checks, community review, and additional built-ins such as declarative filtering and reading modes.

## Judge testing instructions

1. Download https://openpatch-tau.vercel.app/downloads/openpatch-extension-v0.3.0.zip.
2. Unzip it, open `chrome://extensions`, enable Developer mode, and load the folder unpacked.
3. Open https://openpatch-tau.vercel.app/demo/.
4. At 390px, observe horizontal overflow and the blocking survey.
5. Enter synthetic values and choose **Simulate timeout now**; observe the lost fields.
6. Open the extension and enable the verified CivicApply repair.
7. Repeat the timeout; observe the restored draft.
8. Enter an invalid email and continue; inspect the specific visible and ARIA-linked error.
9. Focus a progress step and use Left/Right arrows.

No credentials or API key are needed.

## 2:45 demo video script

**0:00–0:15 — Hook**

“The software that matters most is often software we do not own. When a government form breaks on mobile or loses an application, users normally cannot fix it. OpenPatch is a public repair layer for the web.”

**0:15–0:48 — Show the pain**

Open CivicApply at 390px. Pan across the overflowing form, show the survey covering controls, type a name and email, simulate a timeout, and show the cleared fields. Submit once to show the generic `FORM_12` error.

**0:48–1:25 — Authoring with Codex**

On a page without a repair, type the complaint in the extension and choose **Copy Codex repair brief**. Flash the privacy receipt, paste the brief into Codex, then show `$openpatch-author`, live DOM/screenshot inspection, and the JSON patch. Say: “GPT‑5.6 through Codex authors only these constrained operations. The brief excludes private values, and there is no script, fetch, HTML injection, or API key in the extension.” Flash the validator output: policy passed, 19/19 operations, 10/10 assertions, SHA-256 receipt.

**1:25–2:08 — Visible repair**

Open the extension popup. Point out the exact website, policy-checked patch, permission list, and selector health. Enable the patch. Show the single-column layout and removed survey. Fill the form, simulate timeout, and show “Draft restored.” Enter an invalid email and show the specific accessible message. Use arrow keys on progress steps.

**2:08–2:32 — Community loop**

Show the registry landing page and download the safe patch. On its target page, choose it in OpenPatch and flash the independent policy, scope, 19/19 live-selector, and SHA-256 receipt before installation. “The AI is only needed once, when a patch is authored. Everyone else gets the repair without AI, an account, or an API key.”

**2:32–2:45 — Close**

“Website owner will not fix it? Users can. OpenPatch gives people agency over the software they are forced to use. Fix the web you have.”

## Submission checklist

- [x] Deploy the landing page and CivicApply demo to a stable public URL
- [x] Upload `release/openpatch-extension-v0.3.0.zip` and `release/openpatch-codex-plugin-v0.2.0.zip` to a stable public download
- [x] Attach the validated Codex plugin package and mention the repo-discovered skill path
- [x] Make the repository public under the MIT license, or share private access with the required judge accounts
- [ ] Add repository URL to Devpost
- [ ] Record and upload a public YouTube video under 3 minutes
- [ ] Add YouTube URL to Devpost
- [ ] Run `/feedback` in the primary Codex build thread and add the Session ID
- [x] Add the public demo URL and exact no-login testing instructions
- [ ] Add project thumbnail and before/after screenshots from `dist/previews`
- [ ] Complete all five Devpost steps and submit before July 21, 2026 at 5:00 PM Pacific
