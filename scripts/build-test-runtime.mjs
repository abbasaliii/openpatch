import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
await mkdir(resolve(root, "dist/test"), { recursive: true });
await build({
  entryPoints: {
    "apply-demo-patch": resolve(root, "tests/apply-demo-patch.ts"),
    "preflight-runtime": resolve(root, "tests/preflight-runtime.ts")
  },
  outdir: resolve(root, "dist/test"),
  bundle: true,
  format: "iife",
  target: "chrome120"
});
