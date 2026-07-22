# Patch the Web Build Week engineering record

Patch the Web was created during the OpenAI Build Week submission period. The first repository commit is dated July 19, 2026, and every product milestone below was built in the primary GPT-5.6/Codex thread.

This record is intentionally specific. It documents what the human decided, what GPT-5.6 through Codex helped produce, where those decisions exist in source, and which executable evidence verifies the result.

## Why GPT-5.6 and Codex are part of the product

Patch the Web does not put a chatbot inside the extension. GPT-5.6 operates through Codex at the high-judgment authoring boundary:

1. A person describes a missing capability on a website they do not control.
2. The extension produces a privacy-safe structural Repair Brief.
3. GPT-5.6 through Codex inspects the DOM and screenshots, translates the complaint into acceptance criteria, chooses constrained DSL operations, and authors selectors and behavior tests.
4. The `$patch-the-web-author` skill validates policy, scope, live selectors, behavior, accessibility, and network silence before packaging the patch.
5. The published artifact is declarative data. Everyone downstream installs and runs it without a model, API key, or account.

That separation is deliberate: AI handles ambiguous intent and iterative engineering once; the community receives a deterministic, reviewable, reusable result.

## Human decisions and Codex contribution

| Product or engineering decision | Human judgment | GPT-5.6/Codex contribution | Source evidence |
| --- | --- | --- | --- |
| Public feature layer, not a personal theme editor | Make one repair reusable by everyone affected by the same site | Turned the concept into a browser-extension, registry, and patch-authoring architecture | `src/extension/`, `src/registry/`, `.agents/skills/patch-the-web-author/` |
| Constrained DSL, never arbitrary community JavaScript | Accept less expressiveness in exchange for inspectable permissions and deterministic execution | Implemented and adversarially tested operation, selector, capability, CSS, attribute, persistence, and scope policies | `src/core/types.ts`, `src/core/validator.ts`, `tests/validator.test.ts` |
| Repair genuinely missing capabilities | Replace the early form-only proof with a credible directory that works as designed but fails a real access need | Designed MetroCare, then authored `collectionFilter` and `collectionCompare` as trusted runtime primitives | `src/site/care/`, `src/core/engine.ts`, `src/registry/patches/metrocare-service-navigator.patch-the-web.json` |
| Prove the workflow on a real third-party site | A student asked to see only Karachi programs on FAST-NUCES without changing the university site | Inspected the exact live DOM and screenshots, added a fail-closed `tableColumnFilter` primitive, authored the domain patch, caught a site CSS override in live visual QA, and produced responsive evidence | `src/core/table-filter.ts`, `src/registry/patches/nu-karachi-degree-programs.patch-the-web.json`, `submission-assets/repairs/` |
| Keep authoring context private | Never send field values, page text, cookies, storage, or URL queries to Codex | Built a bounded Repair Brief and tests that prove those exclusions | `src/extension/repair-brief.ts`, `tests/repair-brief.test.ts` |
| Treat website drift as a product state | A community feature must stop being recommended when the original site changes underneath it | Built SHA-bound Chromium compatibility checks, per-operation fingerprints, quarantine behavior, and the public Sentinel | `scripts/check-registry-compatibility.ts`, `src/core/compatibility.ts`, `src/site/sentinel/` |
| Prove privacy and accessibility behavior | Visual polish alone is not evidence | Added assertions for focus movement, ARIA relationships, selection limits, mobile width, persistence, zero interaction requests, and strict axe WCAG A/AA scans | `tests/browser/accessibility.spec.ts`, `tests/browser/patch-the-web.spec.ts`, `tests/engine.test.ts`, `tests/extension/patch-the-web-extension.spec.ts` |

## Dated milestone trail

The public Git history preserves the Build Week sequence:

| Time (Pakistan Standard Time) | Commit | Milestone |
| --- | --- | --- |
| Jul 19, 21:02 | `91ae598` | Safe web-repair MVP |
| Jul 19, 21:18 | `a895cee` | DSL safety and accessibility hardening |
| Jul 19, 22:00 | `3b6d3d4` | Codex authoring skill and registry v0.2 |
| Jul 20, 03:43 | `8f3d164` | Validated community patch installation |
| Jul 20, 04:50 | `3adf6e6` | Missing-feature layer and MetroCare navigator |
| Jul 20, 05:32 | `c49f839` | Verified public registry discovery |
| Jul 20, 06:28 | `e489524` | Compatibility Sentinel and drift quarantine |
| Jul 20 | `v0.7.0` release | Private provider comparison, workspace compatibility receipts, final visual and release hardening |
| Jul 20 | `v0.7.1` hotfix | Canonical cross-platform patch bytes prevent Windows/Linux SHA-256 receipt drift in production builds |
| Jul 20 | `v0.7.2` hardening | Clean-install Linux CI plus six-hour live monitoring, retained receipts, retries, and automatic material quarantine/recovery promotion |
| Jul 20 | `v0.7.3` accessibility | Automated WCAG A/AA audits across patched workflows and public surfaces, hardened contrast tokens, and a keyboard-focusable comparison region |
| Jul 20 | `v0.8.0` control & privacy | Community-patch removal, optional-permission cleanup, absolute preference expiry, sensitive-field hardening, live error repair, and deeper keyboard/browser/extension evidence |
| Jul 21 | `v0.9.0` real public table search | Added a bounded `publicTableSearch` DSL primitive, authored the HEC recognized-campus finder against the live page, handled repeated table headers safely, added mobile layout repair, published 5/5 live compatibility evidence, and expanded the registry to four verified repairs |
| Jul 22 | `v0.14.0` bounded public list search | Added a fail-closed `publicListSearch` primitive, authored a PEC accreditation-directory finder against 170 live institution entries, passed policy and responsive accessibility tests, and correctly quarantined publication when PEC returned HTTP 403 to automated monitoring |
| Jul 22 | `v0.9.1` guided repair requests | Replaced expert-authored acceptance criteria with plain outcome choices, added public-URL privacy cleaning, tab-local draft recovery, a clear Codex handoff, extension guidance, and mobile + WCAG browser evidence |
| Jul 22 | `v0.10.0` safe update recovery | Added a bounded validated patch history, SHA-256 recheck, live selector preflight, exact-domain permission recheck, one-click rollback/redo, and complete removal of repair history |
| Jul 22 | `v0.11.0` confirmed installation | Replaced opaque installs with verified/access/installed/confirmed stages, automatic page verification and retry, simplified registry actions, a production-only store build, and removal of development hosts from publishable patches |
| Jul 22 | `v0.12.0` private request handoff | Let nontechnical users move from an unmatched page to a prefilled community request without copy/paste; the bounded payload stays in a URL fragment, is cleared after local restore, and is proven absent from network requests |
| Jul 22 | `v0.13.0` guarded community intake | Added an account-free, fail-closed serverless submission path with independent privacy validation, abuse bounds, explicit receipts, an account-based fallback, automated duplicate/privacy triage, and understandable five-stage public status cards |

## Iteration examples

Codex did not merely scaffold files. The primary thread repeatedly used browser evidence to change product and engineering decisions:

- The first proof focused on an intentionally poor application form. We rejected that as too small and replaced the flagship with a credible healthcare directory missing search, combined filters, and comparison.
- A fixed-width shell looked broken at 390 px while one document-width metric appeared acceptable. The browser test was rewritten to assert the offending element's actual geometry and retain a strict post-patch viewport-fit invariant.
- Public registry discovery initially proved metadata only. It was extended to verify exact patch bytes, live selector compatibility, scope, and Chrome permissions before installation.
- Compatibility checks initially trusted an already-published patch. A workspace mode was added so candidate patch bytes are fingerprinted against the public target before registry publication.
- The comparison feature received adversarial limits: one exact container, safe `data-*` attributes only, explicit display maps, 2–4 selected items, bounded fields and values, trusted native UI, focus transfer, live announcements, and no page-text or network access.
- A strict axe scan exposed contrast regressions hidden by entrance-animation opacity and a scrollable comparison region missing keyboard focus. We corrected the source color system and focus semantics, then gated all patched and public surfaces at desktop and mobile widths.
- A new TTL regression test proved that initialization recreated an empty preference record immediately after deleting expired state. The runtime now avoids writes on load, preserves an absolute expiry window, and removes storage when the user clears preferences.
- The real FAST-NUCES page overrode the native `hidden` attribute on table cells. The representative fixture passed, but the exact live screenshot still showed unrelated campuses. Codex used that evidence to harden the trusted runtime with an inline `display:none !important` only on already-validated rows and cells, then reran live desktop/mobile capture until both the table and page fit.

## Reproduce the evidence

```bash
npm install
npm run verify
```

The current release gate performs type checking, 80 unit/policy/privacy/API tests, all four patch validators, 42 desktop/mobile browser journeys (including the patched products and public request workflow under strict axe WCAG A/AA scans), and 8 packaged Manifest V3 extension tests. A separate live FAST-NUCES capture verifies the third-party target at desktop and 390px without changing the site.

Additional publication evidence:

```bash
npm run monitor:workspace -- src/registry/compatibility.json
```

- MetroCare: 11/11 constrained operations and 10/10 publishing assertions
- CivicApply: 19/19 constrained operations and 10/10 publishing assertions
- FAST-NUCES: 4/4 constrained operations, 8/8 publishing assertions, 22 relevant rows retained, and 15 excluded
- Public compatibility ledger: 39 healthy operation targets across 4 discoverable patches, plus one quarantined real-site candidate, checked every six hours
- Extension archive SHA-256: `A952870B7606760BC3FFCA68EA695BC4BB26EA6BF0CA9CA879DF422DAFB55CBF`
- Codex plugin archive SHA-256: `EFD9B788FBC90E6248427F2421B3239DAAF2CE398D550B01CED5390880DD06CF`

The required `/feedback` Session ID is submitted in the private Devpost field from this primary build thread. It is not used as a substitute for the public source, history, tests, and receipts above.
