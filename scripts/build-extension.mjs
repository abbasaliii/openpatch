import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(root, "dist/extension");

await rm(outdir, { recursive: true, force: true });
await mkdir(resolve(outdir, "patches"), { recursive: true });

await build({
  entryPoints: {
    background: resolve(root, "src/extension/background.ts"),
    content: resolve(root, "src/extension/content.ts"),
    popup: resolve(root, "src/extension/popup.ts")
  },
  bundle: true,
  outdir,
  format: "iife",
  target: "chrome120",
  minify: false,
  sourcemap: true
});

await Promise.all([
  cp(resolve(root, "src/extension/manifest.json"), resolve(outdir, "manifest.json")),
  cp(resolve(root, "src/extension/popup.html"), resolve(outdir, "popup.html")),
  cp(resolve(root, "src/extension/popup.css"), resolve(outdir, "popup.css")),
  cp(resolve(root, "src/registry/patches"), resolve(outdir, "patches"), { recursive: true })
]);

console.log(`Built unpacked extension at ${outdir}`);
