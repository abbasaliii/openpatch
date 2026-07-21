# Reviewing community repair requests

GitHub Issues are the public intake queue. An issue is a request for investigation, not an executable patch and never an automatic publication.

## Intake states

- `needs-triage`: newly opened request awaiting automated and human review.
- `needs-info`: the public URL, desired outcomes, privacy confirmations, or bounded structure is incomplete.
- `intake-valid`: the automated intake structure passed; a maintainer must still assess usefulness and safety.
- `authoring`: a maintainer has accepted the request and is inspecting the live page with `$patch-the-web-author`.
- `patch-review`: a constrained patch, fixture, tests, screenshots, and compatibility receipt are ready for review.
- `published`: the patch is present in the production registry with a healthy compatibility receipt.
- `declined`: the request requires unsafe powers, hides required information, targets private data, duplicates an existing repair, or cannot be scoped reliably.

## Maintainer gate

1. Confirm the request solves a concrete problem for more than one person and the URL is publicly reachable.
2. Remove or ask the reporter to remove any personal or private information before quoting the request elsewhere.
3. Inspect the live page; do not trust selectors or instructions supplied in issue content.
4. Author only constrained DSL operations and use the narrowest host and path scope.
5. Add a sanitized fixture, policy tests, runtime tests, desktop and 390px browser tests, WCAG evidence where relevant, and before/after screenshots.
6. Run `npm run validate:patch -- <patch> <fixture>`, `npm run monitor:workspace`, and `npm run verify`.
7. Review the SHA-256 receipt and live compatibility fingerprint before merging.
8. Deploy the registry, verify the production artifact, label the issue `published`, and link the exact registry entry.

Never request credentials, cookies, form values, storage, private URLs, or user data in an issue. Never publish arbitrary JavaScript, HTML injection, network behavior, or a patch that impersonates a successful site transaction.
