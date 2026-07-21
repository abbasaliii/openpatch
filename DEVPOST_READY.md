# Patch the Web — final Devpost handoff

> **Preparation only. Do not upload, publish, or click `Submit project` yet.**

This file is the single copy/paste source for the final OpenAI Build Week submission. It was audited against the official rules and current Devpost submission guidance on July 20, 2026.

## Finalization values

1. Public YouTube URL — https://youtu.be/UB6w8ME06G0
2. Codex `/feedback` Session ID — obtained from the primary build thread, stored only in the private release packet, and saved in the Devpost draft.

Do not publish the private Session ID in the repository or public project story.

## Deadline and category

- **Submission deadline:** July 21, 2026 at 5:00 PM PDT — July 22, 2026 at 5:00 AM Pakistan Standard Time.
- **Track:** Apps for Your Life.
- **Submitter type:** Individual / solo builder.
- **Project status:** New project created during the submission period; the public Git history begins July 19, 2026.

## Step 1 — Manage team

- Submit as a solo builder.
- Do not invite teammates unless someone actually contributed and meets the eligibility rules.
- Select the truthful country of residence in Devpost; this is personal eligibility information and is intentionally not prefilled here.

## Step 2 — Project overview

**Project name**

```text
Patch the Web
```

**Tagline — under Devpost's 140-character limit**

```text
Safe, shareable features for websites users do not own—built with Codex, installed by anyone without AI or an account.
```

**Project gallery thumbnail**

```text
submission-assets/patch-the-web-devpost-thumbnail.png
```

- 1536×1024, exact 3:2 ratio
- PNG, 620,862 bytes
- SHA-256: `06C1EB249AA704DA4DEBDE0EBB2B83D16DC0C893831573AFAF46B7554240DB87`

## Step 3 — Project details

### Project story

Paste the Markdown below into **Project story**.

```markdown
## Inspiration

People are forced to use websites they did not choose and cannot change: government forms, university portals, healthcare directories, marketplaces, and legacy work tools. Those sites do not need to be visibly broken to fail someone. A directory can work exactly as designed and still omit the filter an access need requires. The usual answer is “wait for the owner.” Patch the Web gives users another answer.

## What it does

Patch the Web is a public feature layer for the web: a Manifest V3 browser extension, a constrained transformation language, a Codex patch-authoring skill and plugin, and a machine-readable community registry.

One person describes a missing capability to GPT-5.6 through Codex. The Patch the Web authoring workflow inspects the DOM and screenshots, turns the complaint into observable acceptance criteria, chooses safe built-in operations, validates every selector and permission, and runs behavior tests. The published patch is declarative data scoped to exact hosts and paths. It cannot contain arbitrary JavaScript, HTML, callbacks, fetches, cookies, templates, or page-text extraction.

Everyone downstream gets the repair without AI, an account, or an API key. The extension discovers a matching registry patch, validates the DSL and scope again, verifies its SHA-256 receipt, checks the current DOM, requests only the declared Chrome domains, and installs it locally.

Our flagship MetroCare demo starts as a credible twelve-provider healthcare directory with useful data but no search, no combined access filters, and no comparison. An eleven-operation community patch adds private search, type/access/language/availability filters, local preferences, keyboard shortcuts, ARIA announcements, and a keyboard-accessible provider comparison table. Wheelchair access + Urdu + accepting new patients reduces twelve services to one understandable choice. Filtering and comparison emit zero network requests.

CivicApply is a second independently verified patch. Its nineteen constrained operations repair a fixed-width application form, preserve unfinished non-sensitive progress locally, add specific accessible validation and keyboard navigation, move human help into the workflow, and remove an obstructive survey.

## How we built it

- TypeScript safe-transformation DSL with nine bounded capabilities
- Manifest V3 extension with automatic registry discovery, manual import, exact-domain permissions, SHA-256 verification, and live selector preflight
- Trusted collection filter and comparison builders that read only declared `data-*` attributes
- Repository-discovered `.agents/skills/patch-the-web-author` workflow plus an installable Codex plugin
- Vite public product, two realistic demo targets, and machine-readable registry artifacts
- Playwright, Vitest, JSDOM, and axe accessibility tests
- GitHub Actions clean-install CI and a six-hour Compatibility Sentinel
- Vercel production deployment with no login or test account required

GPT-5.6 and Codex were used at the high-judgment engineering boundary: converting the product idea into architecture, authoring and threat-modeling the DSL, iterating from browser evidence, building the extension and registry, writing the two patches, creating the reusable authoring skill, and producing the tests and release evidence. Human decisions set the product direction: a public repair layer rather than a theme editor, deterministic distribution without model calls, and a deliberately constrained DSL instead of a userscript marketplace.

## Challenges

The hardest problem was making repairs powerful enough to add real missing product features without turning the registry into arbitrary-code distribution. `collectionFilter` and `collectionCompare` therefore accept no HTML, JavaScript, callbacks, templates, or URLs. Trusted runtime code creates native controls from one exact collection and explicitly declared data attributes, with bounded item, field, and selection counts.

Website drift was the second hard problem. A valid patch can become unsafe when the original site changes. The Compatibility Sentinel opens every published target in Chromium every six hours, binds the live structural fingerprint to the exact patch SHA, and quarantines drifted or unreachable entries before the extension recommends them.

Accessibility testing also exposed a subtle regression: entrance-animation opacity reduced otherwise acceptable contrast before sections were scrolled into view. Strict axe scans caught it. We fixed the source color system and made the scrollable comparison region labeled and keyboard-focusable instead of suppressing the audit.

## Accomplishments

- A complete author-once, install-many community repair loop
- 11/11 MetroCare operations and 10/10 publication assertions healthy
- 19/19 CivicApply operations and 10/10 publication assertions healthy
- 44 unit, policy, registry, compatibility, preflight, runtime, and privacy tests passing
- 20 desktop/mobile browser journeys passing, including six strict WCAG A/AA scans
- 6 packaged Manifest V3 integration tests passing across install, production, removal, and the domain switch
- 70 checks in the full release gate
- Eight additional post-deploy axe scans across four production surfaces at mobile and desktop widths with zero automated violations
- A six-hour live monitor with transient retries, retained receipts, and automatic quarantine/recovery promotion
- A public MIT-licensed repository, stable no-login demo, extension archive, and Codex plugin archive

## What we learned

The safest repair is the smallest constrained operation that makes an acceptance criterion observable. Selector health is not merely test output; it is a product feature that tells a community when the original site changed. AI belongs at the ambiguous authoring boundary, while distribution should be deterministic, reviewable, private, and cheap for everyone downstream.

## What's next

Publisher signing, moderation, community review, reputation and rollback controls, more repair primitives such as task-focused reading modes and guided multi-step workflows, and real-world pilots with civic, education, and accessibility communities.

## Test it now

Open the live MetroCare directory and choose **Preview Patch the Web instantly**. No build, login, credential, API key, or extension is required. For the full distribution path, the README includes a prebuilt Chrome extension, exact installation steps, supported platforms, and integrity hashes.
```

### Built with tags

Enter the following tags, prioritizing the first six if Devpost limits the count:

```text
Codex
GPT-5.6
TypeScript
Chrome Extensions
Playwright
axe-core
Manifest V3
Vite
Vitest
GitHub Actions
Vercel
JSDOM
```

### Try it out links

Add in this order:

1. **Patch the Web — live product:** https://patch-the-web.vercel.app/
2. **Flagship no-install demo:** https://patch-the-web.vercel.app/care/
3. **Compatibility Sentinel:** https://patch-the-web.vercel.app/sentinel/
4. **CivicApply second repair:** https://patch-the-web.vercel.app/demo/
5. **Public repository:** https://github.com/abbasaliii/patch-the-web

### Video demo link

```text
https://youtu.be/UB6w8ME06G0
```

The link must be a public YouTube URL with embedding allowed. Verify it while signed out before adding it to Devpost.

### Image gallery

Recommended order and captions:

1. `submission-assets/metrocare-before-desktop.png`
   - **Caption:** Before Patch the Web: twelve useful providers, but no search, combined access filters, or comparison.
2. `submission-assets/metrocare-after-desktop.png`
   - **Caption:** The constrained community patch adds a private service navigator and reduces combined needs to one match.
3. `submission-assets/metrocare-compare-desktop.png`
   - **Caption:** A keyboard-accessible comparison table built only from declared `data-*` attributes.
4. `submission-assets/patch-the-web-registry-discovery.png`
   - **Caption:** The extension verifies scope, policy, SHA-256 integrity, scheduled compatibility, and a fresh live preflight before install.
5. `submission-assets/compatibility-sentinel-quarantine.png`
   - **Caption:** Compatibility Sentinel simulates website drift and quarantines an unsafe registry entry.
6. `submission-assets/patch-the-web-repair-brief.png`
   - **Caption:** A privacy-safe Repair Brief for Codex excludes field values, page text, cookies, storage, and URL queries.

If Devpost limits the gallery, keep images 1–4.

## Step 4 — Additional details

### Category

```text
Apps for Your Life
```

### Code repository

```text
https://github.com/abbasaliii/patch-the-web
```

- Public: **Yes**
- License: **MIT**
- Default branch: `main`
- Latest prepared release: https://github.com/abbasaliii/patch-the-web/releases/tag/v0.8.0

### Is this project new?

```text
Yes. Patch the Web was created during the Build Week submission period. The first public commit is dated July 19, 2026, and BUILD_WEEK.md maps each milestone, human decision, GPT-5.6/Codex contribution, and executable proof.
```

### How Codex and GPT-5.6 were used / how the project improved

```text
GPT-5.6 through Codex was the primary engineering collaborator throughout this new project. It translated the public repair-layer concept into a Manifest V3 extension, constrained DSL, public registry, compatibility monitor, and installable authoring skill; authored and threat-modeled the runtime; inspected browser evidence; created behavior, privacy, extension, and accessibility tests; and iterated on failures until the complete release gate passed. Human judgment chose the product direction, rejected an early form-only proof as too small, selected a credible healthcare missing-feature demo, required deterministic no-API-key distribution, and constrained community patches instead of accepting arbitrary userscripts. The dated commit trail and BUILD_WEEK.md distinguish decisions, iterations, and evidence.
```

### Codex `/feedback` Session ID

```text
CODEX_FEEDBACK_SESSION_ID
```

Obtain this from the primary build thread immediately before final submission.

### Judge testing instructions

```text
No account, credential, API key, or rebuild is required.

1. Open https://patch-the-web.vercel.app/care/ and observe twelve service cards with no search, filters, or comparison.
2. Choose “Preview Patch the Web instantly.” The same constrained runtime used by the extension applies and reports 11/11 healthy operations.
3. Select Harbor Family Clinic and Northside Community Health, then choose “Compare selected” to open the keyboard-accessible private decision table.
4. Close and clear the comparison. Choose Wheelchair access, Urdu, and Accepting new patients. Observe “1 of 12 services match” and Harbor Family Clinic.
5. Reload to confirm the preferences stay on-device; press / to focus search.
6. Optional full distribution test: download the prebuilt extension from https://patch-the-web.vercel.app/downloads/patch-the-web-extension-v0.8.0.zip, unzip it, open chrome://extensions, enable Developer mode, choose Load unpacked, and select the unzipped folder. Reopen MetroCare: the extension discovers the matching verified registry patch, checks its receipt and 11/11 current targets, and installs it on the exact domain. The installed patch can then be disabled or removed from the same popup.
7. Open https://patch-the-web.vercel.app/sentinel/ to inspect live compatibility evidence and simulate quarantine.

Supported platform: Chrome/Chromium 120+ on Windows, macOS, and Linux. The live demos work in any modern browser.
```

### Third-party and content disclosure

```text
Patch the Web is original work created during the submission period and released under MIT. It uses standard open-source development libraries including TypeScript, Vite, Playwright, Vitest, JSDOM, esbuild, and axe-core under their respective licenses. MetroCare, CivicApply, their organizations, domains, providers, contact details, and workflows are fictional demonstration data. The project is not medical guidance. The demo contains no copyrighted music. Narration uses the local Microsoft Zira text-to-speech voice; all depicted product interactions are recordings of the working build.
```

## YouTube upload packet

Use [VIDEO_UPLOAD.md](VIDEO_UPLOAD.md) as the authoritative upload source.

- Video: `submission-assets/patch-the-web-demo.mp4`
- Runtime: 2:56
- Resolution: 1536×864, 16:9
- Video SHA-256: `14E66B641E41E4161780B2B5E1D354ED8CB41D87F3592333D4487BFAE9881316`
- Thumbnail: `submission-assets/patch-the-web-youtube-thumbnail.png`
- Captions: `submission-assets/patch-the-web-demo.srt`
- Audience: Not made for kids
- Visibility when authorized: Public
- Embedding: Allowed
- Paid promotion: No
- Music: None

The video is one continuous live browser workflow: public download, Chrome extension verification, original site, verified registry discovery, real patch installation, comparison, filters, reload persistence, and permission review. The YouTube description and submission text carry the full current evidence: 44 unit/policy tests, 20 browser journeys, 6 extension integrations, and eight additional production accessibility scans.

## Final eligibility cross-check

- [x] Built with both Codex and GPT-5.6
- [x] Working project with stable public no-login testing path
- [x] Public MIT-licensed repository
- [x] README documents Codex collaboration, human decisions, setup, supported platforms, and testing
- [x] Demo video is under three minutes, includes audio, shows the working project, and explains Codex + GPT-5.6 use
- [x] No copyrighted music
- [x] Track selected: Apps for Your Life
- [x] Prebuilt extension and Codex plugin provided with hashes
- [x] Production compatibility monitor and clean-install CI passing
- [x] All public links return HTTP 200
- [x] No tracked `.env` files or common credential patterns found
- [x] Public YouTube URL saved in the Devpost draft and verified public
- [x] `/feedback` Session ID added
- [x] Truthful submitter country selected
- [x] Devpost preview proofread after all fields are saved
- [ ] Final submission explicitly authorized by the user

## Final ten-minute submission sequence — only after authorization

1. Run `/feedback` in the primary Codex thread and copy the Session ID.
2. Upload the prepared video to YouTube using [VIDEO_UPLOAD.md](VIDEO_UPLOAD.md); set it public, add the thumbnail and captions, and allow embedding.
3. Verify the public YouTube link in a signed-out/incognito window.
4. Sign in to Devpost and fill Steps 1–4 from this file.
5. Replace both placeholders and search the form for `PUBLIC_YOUTUBE_URL`, `CODEX_FEEDBACK_SESSION_ID`, `TODO`, and `PENDING`; all searches must return zero.
6. Preview the project and test every displayed link.
7. Confirm the project story formatting and image captions.
8. Confirm the category, public repository, MIT license, submitter type, and country.
9. Stop on the final Submit step and perform one last requirements check.
10. Click **Submit project** only after explicit final authorization.

## Authoritative references

- Official rules: https://openai.devpost.com/rules
- Official FAQ: https://openai.devpost.com/details/faqs
- Devpost submission steps: https://help.devpost.com/article/126-know-your-submission-steps
- Devpost video guidance: https://help.devpost.com/article/85-uploading-a-demo-video
- Official Codex skill guidance: https://learn.chatgpt.com/docs/build-skills
- Official Codex plugin guidance: https://learn.chatgpt.com/docs/build-plugins
