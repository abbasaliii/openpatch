# Patch the Web DSL reference

Use schema version `1`. The executable source of truth is `src/core/types.ts`; the policy source of truth is `src/core/validator.ts`.

## Patch envelope

```json
{
  "schemaVersion": 1,
  "id": "org.patchtheweb.site-repair",
  "name": "Site: concise repair name",
  "summary": "What changes for the user.",
  "version": "1.0.0",
  "author": { "name": "Publisher", "verified": false },
  "match": { "hosts": ["example.gov"], "paths": ["/apply/*"] },
  "capabilities": ["layout", "accessibility"],
  "operations": [],
  "verify": [],
  "changelog": "What changed in this version."
}
```

Hosts must be exact or use one leftmost wildcard such as `*.example.edu`. Paths must start with `/` and may use a final `*`. Prefer exact hosts and the narrowest useful paths.

## Allowed operations

### `style`

Set allowlisted visual properties on matched existing elements. Use kebab-case property names. Values cannot contain URLs, imports, expressions, braces, or semicolons. Consult `SAFE_STYLE_PROPERTIES` in `src/core/validator.ts` before using a property.

```json
{
  "id": "mobile-stack",
  "type": "style",
  "selector": ".application-shell",
  "when": { "maxWidth": 760 },
  "styles": { "display": "flex", "flex-direction": "column", "gap": "16px" }
}
```

Capability: `layout`.

### `attributes`

Set only `aria-*`, `role`, `tabindex`, `autocomplete`, `inputmode`, or `title`.

```json
{
  "id": "label-progress",
  "type": "attributes",
  "selector": "#progress-steps",
  "attributes": { "role": "tablist", "aria-label": "Application progress" }
}
```

Capability: `accessibility`.

### `hide`

Hide explicit obstructive elements with `hidden` and `aria-hidden`. Never target disclosures, consent, warnings, or security UI.

```json
{ "id": "hide-survey", "type": "hide", "selector": ".survey-wall" }
```

Capability: `hide-elements`.

### `move`

Move existing matched elements relative to one exact target. Positions: `before`, `after`, `prepend`, `append`.

```json
{
  "id": "move-help",
  "type": "move",
  "selector": ".help-card",
  "target": "#application-form",
  "position": "before"
}
```

Capability: `reorganize`.

### `persistForm`

Store non-sensitive matched form values in origin-local storage. The runtime always excludes passwords, files, hidden controls, submit controls, authentication codes, payment fields identified by autocomplete, and disabled fields.

```json
{
  "id": "save-draft",
  "type": "persistForm",
  "selector": "#application-form",
  "key": "application-draft-v1",
  "include": ["input", "select", "textarea"],
  "ttlMinutes": 1440,
  "statusText": "Draft saved on this device for 24 hours"
}
```

Capability: `local-storage`. The form selector must match exactly one form. Draft expiry is mandatory and must be between 5 minutes and 7 days; use the shortest period that still solves the complaint.

### `validation`

Add local accessible checks without replacing the site's server-side validation. Rules: `required`, `email`, `minLength`, `pattern`.

```json
{
  "id": "email-validation",
  "type": "validation",
  "selector": "#application-form",
  "fields": [
    {
      "selector": "#email",
      "rules": [
        { "kind": "required", "message": "Enter an email address." },
        { "kind": "email", "message": "Use the format name@example.com." }
      ]
    }
  ]
}
```

Capability: `validation`. Messages must say how to fix the problem.

### `keyboardNavigation`

Add roving tabindex and arrow-key focus movement within one container.

```json
{
  "id": "progress-keys",
  "type": "keyboardNavigation",
  "container": "#progress-steps",
  "items": "button",
  "orientation": "horizontal",
  "wrap": true
}
```

Capability: `keyboard-navigation`.

### `collectionFilter`

Add a trusted, accessible search-and-filter navigator to one existing collection. The runtime builds native controls itself; patches cannot provide HTML or event code. Search and filter values are matched only against explicitly declared `data-*` attributes on existing items—never page text, form values, cookies, or network data.

```json
{
  "id": "service-navigator",
  "type": "collectionFilter",
  "selector": "#service-directory",
  "items": ".service-card",
  "title": "Find a service that fits you",
  "description": "Combine access and language needs privately on this device.",
  "search": {
    "label": "Search services",
    "placeholder": "Try dentist or family doctor",
    "attributes": ["data-service-name", "data-keywords"]
  },
  "filters": [
    {
      "id": "access",
      "label": "Access need",
      "attribute": "data-access",
      "options": [
        { "value": "wheelchair", "label": "Wheelchair access" },
        { "value": "telehealth", "label": "Telehealth" }
      ]
    }
  ],
  "persist": { "key": "service-needs-v1", "ttlMinutes": 1440 }
}
```

Capabilities: `content-filter`, `accessibility`, and `keyboard-navigation`; also `local-storage` when `persist` is present. The collection selector must match exactly one element, every searchable field and facet must name a safe `data-*` attribute, filters expire within seven days, and the runtime caps the collection at 100 items. `/` focuses search and Escape clears it.

### `collectionCompare`

Add a trusted, accessible side-by-side comparison to an existing collection. The runtime creates selection controls and the comparison table. The patch can declare only safe `data-*` attributes and bounded value-to-label maps; it cannot provide HTML, scripts, callbacks, templates, or URLs.

```json
{
  "id": "compare-services",
  "type": "collectionCompare",
  "selector": "#service-directory",
  "items": ".service-card",
  "title": "Compare services privately",
  "description": "Choose up to three services for a side-by-side view.",
  "itemTitleAttribute": "data-service-name",
  "maxItems": 3,
  "fields": [
    {
      "id": "access",
      "label": "Access options",
      "attribute": "data-access",
      "values": [
        { "value": "wheelchair", "label": "Wheelchair access" },
        { "value": "telehealth", "label": "Telehealth" }
      ]
    },
    {
      "id": "language",
      "label": "Languages",
      "attribute": "data-languages",
      "values": [
        { "value": "urdu", "label": "Urdu" },
        { "value": "spanish", "label": "Spanish" }
      ]
    }
  ]
}
```

Capabilities: `content-compare`, `accessibility`, and `keyboard-navigation`. The collection must match exactly one container with at least two items, every item must have a unique non-empty title in the declared title attribute, `maxItems` must be 2–4, and every comparison field must use a safe `data-*` attribute with an explicit bounded display map. The runtime caps the collection at 100 items and sends no interaction data.

### `tableColumnFilter`

Focus one bounded public data table on the rows marked in a named column. The runtime resolves the column from one exact normalized header, keeps only rows whose target cell contains one declared marker, collapses unrelated columns, and supplies accessible table, column, and marker labels. Patches cannot supply scripts, HTML, callbacks, URLs, or arbitrary attributes.

```json
{
  "id": "show-karachi-programs-only",
  "type": "tableColumnFilter",
  "selector": "table.degree-programs",
  "headerSelector": "tr.table-heading > th",
  "rowSelector": "tr",
  "headerText": "Karachi",
  "markerSelector": ".available",
  "tableLabel": "Degree programs offered at the Karachi campus",
  "columnLabel": "Karachi campus availability",
  "markerLabel": "Offered at Karachi campus",
  "collapseOtherColumns": true
}
```

Capabilities: `content-filter`, `hide-elements`, and `accessibility`. The outer selector must resolve to exactly one table, the header list must contain 2-20 cells, the public header must match exactly once, the table must contain 1-100 rows, and every target cell may contain at most one marker. The operation fails closed before mutation if any bound or relationship is violated. It reads no form values, cookies, storage, query strings, or network data.

### `publicTableSearch`

Add one trusted, local-only search control across a bounded set of public data tables. The runtime builds the accessible interface, searches only existing public row text in memory, preserves section rows, supports repeated identical headers, announces match counts, and never sends queries or page content to a network service.

```json
{
  "id": "search-recognized-campuses",
  "type": "publicTableSearch",
  "selector": "table.recognized-campuses",
  "rowSelector": "tr",
  "headerText": "S. No",
  "title": "Find a recognized campus",
  "description": "Search university names, cities, and campus locations.",
  "searchLabel": "Search recognized campuses",
  "placeholder": "Try Karachi or a university name",
  "tableLabel": "Recognized university campuses table",
  "maxTables": 2,
  "maxRows": 120
}
```

Capabilities: `content-filter`, `accessibility`, and `keyboard-navigation`. The selector must resolve only to 1-5 tables. Each table must contain 1-12 exact normalized header rows with the same 2-12-column shape and at least one matching data row. The combined searchable set is capped at the declared `maxRows` and an absolute maximum of 300. `/` focuses search and Escape clears it. Any ambiguous structure or exceeded bound fails closed before mutation.

### `publicListSearch`

Add one trusted, local-only search control across a bounded collection of public top-level list items. The runtime builds the accessible interface, searches only existing public item text in memory, announces match counts, and never persists or transmits the query.

```json
{
  "id": "search-accredited-programs",
  "type": "publicListSearch",
  "selector": "#public-directory",
  "itemSelector": ".region > ol > li",
  "title": "Find an accredited program",
  "description": "Search institutions, cities, disciplines, and intake years.",
  "searchLabel": "Search accredited programs",
  "placeholder": "Try Karachi or software engineering",
  "itemLabel": "institutions",
  "maxItems": 220
}
```

Capabilities: `content-filter`, `accessibility`, and `keyboard-navigation`. The outer selector must resolve to exactly one non-form container. The item selector must resolve only to 1-300 non-overlapping, non-empty `<li>` elements under that container. Any selected item containing a form, input, select, textarea, button, or editable content fails closed before mutation. `/` focuses search and Escape clears it.

## Assertions

Use `exists` to lock selector counts and `attribute` to verify repaired semantics.

```json
[
  { "type": "exists", "selector": "#application-form", "min": 1, "max": 1 },
  { "type": "attribute", "selector": "#email", "name": "aria-required", "value": "true" }
]
```

## Selector policy

- Prefer `data-testid`, stable `data-*`, IDs, stable form names, and semantic attributes.
- Avoid generated class names, positional selectors, deep descendant chains, and visible copy that changes by locale.
- Do not use document-wide roots or universal selectors.
- Count selectors against the current DOM before authoring.
- Treat a changed count as breakage, not permission to broaden the selector.
