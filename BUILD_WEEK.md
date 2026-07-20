# OpenPatch Build Week engineering record

OpenPatch was created during the OpenAI Build Week submission period. The first repository commit is dated July 19, 2026, and every product milestone below was built in the primary GPT-5.6/Codex thread.

This record is intentionally specific. It documents what the human decided, what GPT-5.6 through Codex helped produce, where those decisions exist in source, and which executable evidence verifies the result.

## Why GPT-5.6 and Codex are part of the product

OpenPatch does not put a chatbot inside the extension. GPT-5.6 operates through Codex at the high-judgment authoring boundary:

1. A person describes a missing capability on a website they do not control.
2. The extension produces a privacy-safe structural Repair Brief.
3. GPT-5.6 through Codex inspects the DOM and screenshots, translates the complaint into acceptance criteria, chooses constrained DSL operations, and authors selectors and behavior tests.
4. The `$openpatch-author` skill validates policy, scope, live selectors, behavior, accessibility, and network silence before packaging the patch.
5. The published artifact is declarative data. Everyone downstream installs and runs it without a model, API key, or account.

That separation is deliberate: AI handles ambiguous intent and iterative engineering once; the community receives a deterministic, reviewable, reusable result.

## Human decisions and Codex contribution

| Product or engineering decision | Human judgment | GPT-5.6/Codex contribution | Source evidence |
| --- | --- | --- | --- |
| Public feature layer, not a personal theme editor | Make one repair reusable by everyone affected by the same site | Turned the concept into a browser-extension, registry, and patch-authoring architecture | `src/extension/`, `src/registry/`, `.agents/skills/openpatch-author/` |
| Constrained DSL, never arbitrary community JavaScript | Accept less expressiveness in exchange for inspectable permissions and deterministic execution | Implemented and adversarially tested operation, selector, capability, CSS, attribute, persistence, and scope policies | `src/core/types.ts`, `src/core/validator.ts`, `tests/validator.test.ts` |
| Repair genuinely missing capabilities | Replace the early form-only proof with a credible directory that works as designed but fails a real access need | Designed MetroCare, then authored `collectionFilter` and `collectionCompare` as trusted runtime primitives | `src/site/care/`, `src/core/engine.ts`, `src/registry/patches/metrocare-service-navigator.openpatch.json` |
| Keep authoring context private | Never send field values, page text, cookies, storage, or URL queries to Codex | Built a bounded Repair Brief and tests that prove those exclusions | `src/extension/repair-brief.ts`, `tests/repair-brief.test.ts` |
| Treat website drift as a product state | A community feature must stop being recommended when the original site changes underneath it | Built SHA-bound Chromium compatibility checks, per-operation fingerprints, quarantine behavior, and the public Sentinel | `scripts/check-registry-compatibility.ts`, `src/core/compatibility.ts`, `src/site/sentinel/` |
| Prove privacy and accessibility behavior | Visual polish alone is not evidence | Added assertions for focus movement, ARIA relationships, selection limits, mobile width, persistence, and zero interaction requests | `tests/browser/openpatch.spec.ts`, `tests/engine.test.ts`, `tests/extension/openpatch-extension.spec.ts` |

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

## Iteration examples

Codex did not merely scaffold files. The primary thread repeatedly used browser evidence to change product and engineering decisions:

- The first proof focused on an intentionally poor application form. We rejected that as too small and replaced the flagship with a credible healthcare directory missing search, combined filters, and comparison.
- A fixed-width shell looked broken at 390 px while one document-width metric appeared acceptable. The browser test was rewritten to assert the offending element's actual geometry and retain a strict post-patch viewport-fit invariant.
- Public registry discovery initially proved metadata only. It was extended to verify exact patch bytes, live selector compatibility, scope, and Chrome permissions before installation.
- Compatibility checks initially trusted an already-published patch. A workspace mode was added so candidate patch bytes are fingerprinted against the public target before registry publication.
- The comparison feature received adversarial limits: one exact container, safe `data-*` attributes only, explicit display maps, 2–4 selected items, bounded fields and values, trusted native UI, focus transfer, live announcements, and no page-text or network access.

## Reproduce the evidence

```bash
npm install
npm run verify
```

The release gate performs type checking, 43 unit/policy/privacy tests, both patch validators, 14 desktop/mobile browser journeys, and 4 packaged Manifest V3 extension tests—including public registry discovery and execution on the real production domain.

Additional publication evidence:

```bash
npm run monitor:workspace -- src/registry/compatibility.json
```

- MetroCare: 11/11 constrained operations and 10/10 publishing assertions
- CivicApply: 19/19 constrained operations and 10/10 publishing assertions
- Public compatibility ledger: 30 operation targets, checked every six hours
- Extension archive SHA-256: `84D5BA1FE1D947771C92097B9A930EB74D90CD4DD88AAE9990448451F7409665`
- Codex plugin archive SHA-256: `E78D5ACC07F5F4E17BE4D8E2EB37905A56BACA14E591DFBA7403BB3E4BFEDED9`

The required `/feedback` Session ID is submitted in the private Devpost field from this primary build thread. It is not used as a substitute for the public source, history, tests, and receipts above.
