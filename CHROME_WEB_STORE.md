# Chrome Web Store release pack

## Listing copy

**Name:** Patch the Web

**Summary:** Safe community repairs for websites you do not own.

**Single purpose:** Patch the Web helps people install verified, domain-scoped usability and accessibility repairs on the specific websites they choose.

**Description:**

Patch the Web lets people add a missing feature to a website without installing arbitrary scripts. Community repairs are constrained JSON manifests that can only use allowlisted transformations such as layout fixes, accessibility labels, keyboard navigation, local draft recovery, public-table filtering, and removal of explicit obstructive UI.

Before a repair runs, Patch the Web validates its policy, checks its exact host and path scope, confirms a SHA-256 receipt, and preflights every selector against the page currently open. The extension applies only a repair the user explicitly installs for that domain.

When a repair is updated, Patch the Web keeps at most three validated previous versions locally. A restore rechecks the saved SHA-256 receipt, DSL policy, current selectors, and exact-domain permission before switching versions. Removing the repair also removes its local history.

No account. No API key. No advertising. No sale of user data.

## Privacy practices answers

- **Does it collect or transmit user data?** No. Patch manifests, selector-health results, and optional local preferences remain in the browser. The public registry is fetched from Patch the Web only to discover signed-style patch metadata and manifests; no browsing history, page content, form values, cookies, storage, or query strings are sent.
- **Remote code:** No. The extension never downloads or executes remote JavaScript. Downloaded patch JSON is validated against a constrained allowlist and cannot contain scripts, HTML, callbacks, fetches, cookies, or eval.
- **Permissions:**
  - `activeTab`: inspect only the tab a user opens the popup on.
  - `scripting`: apply a validated repair only after user confirmation.
  - `storage`: store installed-patch settings and explicitly allowed local preferences such as a non-sensitive form draft.
  - optional host access: requested only for the exact site of an explicitly installed repair.

## Upload checklist

1. Run `npm run check`, `npm run test:browser`, and `npm run test:extension`.
2. Run `npm run build:extension:store`. This produces a minified package without source maps or development-only localhost permissions.
3. Run `node scripts/generate-store-assets.mjs`.
4. Upload `release/patch-the-web-extension-v0.12.0.zip`; it contains the extension files at the archive root. Expected SHA-256: `15CD4FA42204835E54B6A15455E9CDE990D57C55BE0951D210854F73F67B62F5`.
5. In Chrome Web Store Developer Dashboard, upload the ZIP, use the listing copy above, and add `https://patch-the-web.vercel.app/privacy/` as the privacy-policy URL.
6. Set **Remote code: No** and certify no user-data collection/transmission.
7. Begin as **unlisted** beta; do not claim affiliation with sites that community patches repair.
8. Supply the 1280×800 promo image from `submission-assets/chrome-web-store/` and 128px icon from `src/extension/icons/`.

Human dashboard submission remains required because it is tied to the developer account and policy certifications.
