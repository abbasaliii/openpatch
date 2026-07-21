# Reviewing community repair requests

GitHub Issues are the public intake queue. An issue is a request for investigation, not an executable patch and never an automatic publication.

People may enter that queue in two ways: the guided site can create the issue through the guarded no-account intake, or the person can use the reviewed GitHub fallback under their own account. Both paths generate the same bounded body, labels, automated checks, and human gate. Direct intake collects no reporter identity or contact information.

The read-only public lifecycle dashboard is available at <https://patch-the-web.vercel.app/requests/>. It intentionally displays issue metadata only and links back to GitHub for the complete public discussion.

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

## Direct-intake deployment

The serverless endpoint is disabled unless both `REPAIR_SUBMISSION_ENABLED=true` and `GITHUB_REPAIR_TOKEN` exist. The token must be a fine-grained token limited to `abbasaliii/patch-the-web` with only **Issues: write**, an expiration date, and no account-wide or contents permission. Add both values separately to Vercel Preview and Production, then redeploy and verify `GET /api/repair-requests` reports `directSubmission: true`.

The endpoint requires same-origin JSON, enforces a 12 KB body limit, validates every field independently of the browser, strips query strings and fragments again, rejects likely contact/account/credential values, uses a honeypot and minimum-review window, and permits at most three attempts per network per warm function instance. Configure an infrastructure-level Vercel rate-limit rule for `/api/repair-requests` before advertising the endpoint broadly. Disable the launch switch immediately if the public issue queue receives abuse.

Never request credentials, cookies, form values, storage, private URLs, or user data in an issue. Never publish arbitrary JavaScript, HTML injection, network behavior, or a patch that impersonates a successful site transaction.
