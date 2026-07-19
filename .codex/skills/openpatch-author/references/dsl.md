# OpenPatch DSL reference

Use schema version `1`. The executable source of truth is `src/core/types.ts`; the policy source of truth is `src/core/validator.ts`.

## Patch envelope

```json
{
  "schemaVersion": 1,
  "id": "org.openpatch.site-repair",
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
  "statusText": "Draft saved on this device"
}
```

Capability: `local-storage`. The form selector must match exactly one form.

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
