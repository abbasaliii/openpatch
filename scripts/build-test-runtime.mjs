import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
await mkdir(resolve(root, "dist/test"), { recursive: true });
await build({
  entryPoints: [resolve(root, "tests/apply-demo-patch.ts")],
  outfile: resolve(root, "dist/test/apply-demo-patch.js"),
  bundle: true,
  format: "iife",
  target: "chrome120"
});
