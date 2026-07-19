# OpenPatch — submission kit

## Project overview

**Project name:** OpenPatch

**Elevator pitch:** A safe public repair layer for the web—author domain-scoped fixes with Codex, then let anyone install them with one click, without AI or an account.

**Recommended track:** Apps for Your Life

The authoring workflow is technical, but the product's end user is a citizen, student, patient, shopper, or worker who needs an everyday website to function. Position OpenPatch as consumer agency over shared digital infrastructure.

## Description

### Inspiration

People are forced to use websites they did not choose and cannot change: government forms, university portals, healthcare services, marketplaces, and legacy work tools. When those sites lose progress, break on mobile, or regress in accessibility, the usual answer is “wait for the owner.” OpenPatch gives users another answer.

### What it does

OpenPatch is a browser extension, a constrained transformation language, a Codex patch-authoring skill, and a public repair-registry concept.

A user opens a broken page and describes the problem to Codex. Codex inspects the live DOM and screenshots, maps the complaint to safe built-in operations, validates every selector and permission, and runs browser behavior tests. The resulting versioned patch runs only on its declared host and paths. Other users install the repair without AI, an account, or an API key.

Our CivicApply demo repairs a public-benefits form with 19 declarative operations. It fixes the 390px layout, preserves unfinished progress locally, restores a draft after a simulated session reset, adds accessible validation and arrow-key navigation, moves help into the workflow, and removes a blocking survey.

### How we built it

- Manifest V3 Chrome extension with a polished permission and health receipt
- TypeScript transformation DSL and runtime
- Fail-closed security validator with CSS, attribute, selector, scope, and capability allowlists
- Repository-local `$openpatch-author` Codex skill
- Versioned JSON patch registry entry
- JSDOM unit tests plus Playwright desktop and 390px before/after tests
- Vite landing page and intentionally broken CivicApply test portal

GPT‑5.6 operates through Codex while a patch is authored and tested. The installed extension contains no model call and needs no OpenAI API key.

### Challenges

The hardest constraint was making repairs useful without turning the product into an arbitrary-code marketplace. We modeled every repair as a typed built-in, rejected unsafe CSS and attributes, excluded sensitive form fields at runtime, required exact scope and selector counts, and made browser tests prove user-visible behavior.

Responsive testing also exposed a subtle issue: device emulation can clamp document measurements even when a fixed-width application shell is visibly broken. We changed the test to assert the offending element's geometry directly and kept a strict post-patch viewport-fit assertion.

### Accomplishments

- 19/19 operations healthy
- 8/8 security and runtime tests passing
- 4/4 desktop and mobile browser tests passing
- 4/4 publishing assertions passing
- A working no-account, no-API-key extension flow
- A validated Codex skill that turns complaints into test-gated patches

### What we learned

The safest repair is the smallest operation that makes an acceptance criterion observable. Selector health is not merely test output; it is a product feature that tells a community when the original site changed. And for accessibility work, “looks fixed” is insufficient—keyboard focus and ARIA relationships must be asserted.

### What's next

Publisher signing and moderation, remote registry sync and revocation, optional per-domain Chrome permissions, automated scheduled breakage checks, patch discovery by URL, community review, and additional built-ins such as declarative filtering and reading modes.

## Judge testing instructions

1. Download the attached extension build or use `release/openpatch-extension-v0.1.0.zip`.
2. Unzip it, open `chrome://extensions`, enable Developer mode, and load the folder unpacked.
3. Start or open the public CivicApply demo URL.
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

**0:48–1:22 — Authoring with Codex**

Show the `$openpatch-author` skill, the complaint, the DOM/selector evidence, and the JSON patch. Say: “GPT‑5.6 through Codex authors only these constrained operations. There is no script, fetch, HTML injection, or API key in the extension.” Flash the validator output: policy passed, 19/19 operations, 4/4 assertions, SHA-256 receipt.

**1:22–2:08 — Visible repair**

Open the extension popup. Point out the exact website, permission list, verified publisher, and selector health. Enable the patch. Show the single-column layout and removed survey. Fill the form, simulate timeout, and show “Draft restored.” Enter an invalid email and show the specific accessible message. Use arrow keys on progress steps.

**2:08–2:32 — Community loop**

Show the registry landing page. “The AI is only needed once, when a patch is authored. Everyone else gets the repair with one click—no AI, account, or API key.” Show domain scope and breakage health.

**2:32–2:45 — Close**

“Website owner will not fix it? Users can. OpenPatch gives people agency over the software they are forced to use. Fix the web you have.”

## Submission checklist

- [ ] Deploy the landing page and CivicApply demo to a stable public URL
- [ ] Upload the extension ZIP to a stable public download or attach it to a GitHub release
- [ ] Make the repository public under the MIT license, or share private access with the required judge accounts
- [ ] Add repository URL to Devpost
- [ ] Record and upload a public YouTube video under 3 minutes
- [ ] Add YouTube URL to Devpost
- [ ] Run `/feedback` in the primary Codex build thread and add the Session ID
- [ ] Add the public demo URL and exact no-login testing instructions
- [ ] Add project thumbnail and before/after screenshots from `dist/previews`
- [ ] Complete all five Devpost steps and submit before July 21, 2026 at 5:00 PM Pacific
