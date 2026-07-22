# Chrome Web Store release pack — v0.17.0

This document contains the exact listing, privacy answers, reviewer path, package receipt, and asset inventory for the first Chrome Web Store submission. Dashboard publication is intentionally a human-controlled final step.

## Listing copy

**Name:** Patch the Web

**Summary:** Safe community repairs for websites you do not own.

**Single purpose:** Patch the Web lets a person discover, review, install, and control a verified usability or accessibility repair for the exact website they choose.

**Detailed description:**

Patch the Web adds missing usability features to websites without installing arbitrary community scripts. Repairs are constrained JSON manifests. They can use only allowlisted transformations such as responsive layout fixes, accessibility attributes, keyboard navigation, bounded local draft recovery, public-directory search and filtering, or removal of an explicitly matched obstruction.

Before a repair runs, Patch the Web opens a persistent guided installer that checks its policy, exact host and path, SHA-256 receipt, live compatibility status, and every required selector on the open page. Chrome then asks for access to that repair’s exact domain while the receipt stays visible. The repair can be disabled, removed, updated, or restored to a previously validated version at any time. A built-in My repairs control center shows every installed scope and version across domains without requesting browsing-history access.

If no repair exists, a person can describe the outcome they want in plain language. The extension creates a privacy-safe request containing only the public origin/path, the person’s complaint, and broad outcome categories. It excludes page text, field values, cookies, storage, and URL query strings.

No account or API key is needed to install and use community repairs. Patch manifests cannot execute JavaScript, inject arbitrary HTML, call remote services, read cookies, or access browser history.

## Privacy practices

Chrome Web Store privacy answers must disclose local handling as well as transmission. Use these answers rather than claiming the extension handles no data.

- **Website content:** Yes, limited handling. The extension inspects structural selectors and public directory text on the active page to validate and apply an explicitly chosen repair. Some repairs may locally save non-sensitive form progress or filter preferences when their receipt declares that capability. Sensitive fields are excluded. This information is processed and stored only in the browser and is not transmitted by the extension.
- **User activity / browsing history:** No collection. The extension does not build, store, or transmit browsing history. It uses the current tab URL only to match an exact repair scope.
- **Authentication, financial, health, location, personal communications:** Not collected or transmitted. Persistence rules reject passwords, payment fields, verification codes, files, and other sensitive inputs.
- **Repair requests:** Only after explicit review and confirmation, the public origin/path, user-written complaint, selected outcome categories, and a random request identifier may be submitted to the public request service. No account name or email is requested.
- **Registry request:** The extension fetches the public Patch the Web registry to discover patch metadata and compatibility receipts. It does not attach page content, form values, cookies, storage, URL queries, or browsing history.
- **Advertising, profiling, sale, credit decisions:** None.
- **Remote code:** No. Downloaded JSON is validated against a constrained allowlist and cannot contain scripts, HTML callbacks, fetches, cookies, `eval`, or executable code.

Privacy policy URL: `https://patch-the-web.vercel.app/privacy/`

## Permission justifications

- `activeTab`: identify and inspect only the page on which the person opened the extension.
- `scripting`: run the bundled structural preflight and constrained repair runtime after user action.
- `storage`: keep installed-repair settings, bounded version history, a session-only installation handoff that expires after fifteen minutes, and explicitly disclosed local preferences or non-sensitive draft data.
- `optional_host_permissions`: request access only for the exact origin declared by the repair the person chose; the base store install does not request blanket website access.

## Reviewer test path

1. Install the uploaded package and confirm the welcome page opens.
2. Open `https://patch-the-web.vercel.app/care/`.
3. Open Patch the Web. The popup should show **MetroCare: personal service navigator**, its exact domain, SHA-256-backed registry receipt, and `11/11` live compatibility health.
4. Choose **Install verified community feature**. Confirm the full-page installer shows the exact domain, path, capabilities, `11/11` live selector result, and SHA-256 receipt.
5. Choose **Approve website and install**, approve access to `patch-the-web.vercel.app` if Chrome asks, and confirm all four installation stages complete without losing the receipt.
6. Return to the repaired page and confirm it now has local search, three access filters, private preference persistence, comparison controls, and accessible result counts.
7. Disable the repair with the domain-scoped switch, then re-enable it.
8. Open **My repairs** from the popup footer. Confirm MetroCare appears with its exact scope, registry source, version, update state, and enable/remove controls.
9. Open an unsupported normal website and open the extension. Choose **Add search & filters** to verify the plain-language repair-request helper. Do not submit the public request during review.

Expected network behavior: the extension may request `https://patch-the-web.vercel.app/registry/index.json` and the matching patch JSON. Typing into filters, using comparison, and applying the repair generates no page-data request.

## Package receipt

- Upload: `release/patch-the-web-extension-v0.17.0.zip`
- Size: 85,717 bytes
- SHA-256: `AC6E595367706B51EC5FC8A17FA1D140323E6614E76A53AD867F2E1AB3B347CD`
- Manifest: V3
- Archive layout: `manifest.json` and extension files are at the ZIP root
- Store build: minified, no source maps, no localhost or `127.0.0.1` host permissions

## Visual assets

- Screenshot 1, 1280×800: `submission-assets/chrome-web-store/screenshot-1-before-after-1280x800.png`
- Screenshot 2, 1280×800: `submission-assets/chrome-web-store/screenshot-2-how-it-works-1280x800.png`
- Small promotional tile, 440×280: `submission-assets/chrome-web-store/small-promo-440x280.png`
- Marquee promotional tile, 1400×560: `submission-assets/chrome-web-store/marquee-1400x560.png`
- Store icon, 128×128: `src/extension/icons/icon-128.png`

## Final dashboard checklist

1. Run `npm run verify` and `npm run test:extension:store`.
2. Upload the v0.17.0 ZIP and use the listing copy above.
3. Complete privacy disclosures using the local-handling details above; do not select a blanket “no user data” answer.
4. Add the privacy-policy URL, screenshots, small tile, marquee tile, category, language, and support URL.
5. Paste the reviewer test path into the reviewer notes.
6. Start as an **unlisted beta**. Do not claim affiliation with websites repaired by community patches.
7. Review every certification yourself, then submit from the developer account.
