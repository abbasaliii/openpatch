import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const storeBuild = process.argv.includes("--store");
const outdir = resolve(root, storeBuild ? "dist/extension-store" : "dist/extension");

await rm(outdir, { recursive: true, force: true });
await mkdir(resolve(outdir, "patches"), { recursive: true });
await mkdir(resolve(outdir, "icons"), { recursive: true });

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
  minify: storeBuild,
  sourcemap: !storeBuild
});

await Promise.all([
  cp(resolve(root, "src/extension/popup.html"), resolve(outdir, "popup.html")),
  cp(resolve(root, "src/extension/popup.css"), resolve(outdir, "popup.css")),
  cp(resolve(root, "src/extension/welcome.html"), resolve(outdir, "welcome.html")),
  cp(resolve(root, "src/extension/welcome.css"), resolve(outdir, "welcome.css")),
  cp(resolve(root, "src/extension/icons"), resolve(outdir, "icons"), { recursive: true }),
  cp(resolve(root, "src/registry/patches"), resolve(outdir, "patches"), { recursive: true })
]);

const manifest = JSON.parse(await readFile(resolve(root, "src/extension/manifest.json"), "utf8"));
if (storeBuild) {
  manifest.host_permissions = manifest.host_permissions.filter((origin) => !origin.includes("localhost") && !origin.includes("127.0.0.1"));
}
await writeFile(resolve(outdir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built ${storeBuild ? "Chrome Web Store" : "unpacked"} extension at ${outdir}`);
