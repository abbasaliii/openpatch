import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { applyPatch } from "../src/core/engine";
import { canonicalPatchSource } from "../src/core/patch-source";
import type { OpenPatch } from "../src/core/types";
import { validatePatch } from "../src/core/validator";

const patchPath = resolve(process.argv[2] ?? "src/registry/patches/civic-apply.openpatch.json");
const htmlPath = resolve(process.argv[3] ?? "src/site/demo/index.html");
const raw = canonicalPatchSource(await readFile(patchPath, "utf8"));
const candidate: unknown = JSON.parse(raw);
const result = validatePatch(candidate);

if (!result.ok) {
  console.error("Patch rejected by the OpenPatch policy validator:\n");
  result.issues.forEach((issue) => console.error(`  ✗ ${issue.path}: ${issue.message}`));
  process.exitCode = 1;
} else {
  const patch = result.patch;
  const html = await readFile(htmlPath, "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/demo/", pretendToBeVisual: true });
  const health = applyPatch(patch, {
    document: dom.window.document,
    window: dom.window as unknown as Window,
    storage: dom.window.localStorage
  });
  const assertionIssues = verifyAssertions(patch, dom.window.document);
  const digest = createHash("sha256").update(raw).digest("hex");

  console.log(`✓ Policy validation passed: ${patch.name} v${patch.version}`);
  console.log(`✓ ${health.healthy}/${health.total} constrained operations applied to the demo fixture`);
  if (assertionIssues.length > 0) {
    assertionIssues.forEach((issue) => console.error(`  ✗ ${issue}`));
    process.exitCode = 1;
  } else {
    console.log(`✓ ${patch.verify.length}/${patch.verify.length} publishing assertions passed`);
    console.log(`✓ SHA-256 ${digest}`);
  }
}

function verifyAssertions(patch: OpenPatch, document: Document) {
  const issues: string[] = [];
  for (const assertion of patch.verify) {
    const matches = [...document.querySelectorAll(assertion.selector)];
    if (assertion.type === "exists") {
      if (assertion.min !== undefined && matches.length < assertion.min) issues.push(`${assertion.selector} matched ${matches.length}; expected at least ${assertion.min}`);
      if (assertion.max !== undefined && matches.length > assertion.max) issues.push(`${assertion.selector} matched ${matches.length}; expected at most ${assertion.max}`);
    } else if (matches.length !== 1 || matches[0].getAttribute(assertion.name) !== assertion.value) {
      issues.push(`${assertion.selector} did not have ${assertion.name}=${JSON.stringify(assertion.value)}`);
    }
  }
  return issues;
}
