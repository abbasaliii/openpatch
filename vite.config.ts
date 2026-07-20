import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { validatePatch } from "./src/core/validator";

const root = __dirname;
const siteOut = resolve(root, "dist/site");
const patchSourceDir = resolve(root, "src/registry/patches");
const releaseFiles = ["openpatch-extension-v0.5.0.zip", "openpatch-codex-plugin-v0.3.0.zip"];

async function loadRegistryArtifacts() {
  const patchFiles = (await readdir(patchSourceDir)).filter((file) => file.endsWith(".openpatch.json")).sort();
  const artifacts = await Promise.all(patchFiles.map(async (fileName) => {
    const sourcePath = resolve(patchSourceDir, fileName);
    const raw = await readFile(sourcePath, "utf8");
    const validation = validatePatch(JSON.parse(raw) as unknown);
    if (!validation.ok) throw new Error(`${fileName} failed registry policy validation: ${validation.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
    const patch = validation.patch;
    return { fileName, sourcePath, raw, patch };
  }));
  const registry = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    patches: artifacts.map(({ fileName, raw, patch }) => ({
      id: patch.id,
      name: patch.name,
      summary: patch.summary,
      version: patch.version,
      author: patch.author,
      scope: patch.match,
      capabilities: patch.capabilities,
      download: `/registry/patches/${fileName}`,
      sha256: createHash("sha256").update(raw).digest("hex"),
      verification: {
        status: "verified",
        operations: patch.operations.length,
        assertions: patch.verify.length
      },
      changelog: patch.changelog
    }))
  };
  return { artifacts, registry };
}

const registryPlugin: Plugin = {
  name: "openpatch-public-registry",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = request.url?.split("?", 1)[0];
      if (pathname !== "/registry/index.json" && !pathname?.startsWith("/registry/patches/")) return next();
      try {
        const registryArtifacts = await loadRegistryArtifacts();
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        if (pathname === "/registry/index.json") {
          response.end(JSON.stringify(registryArtifacts.registry, null, 2));
          return;
        }
        const fileName = pathname?.slice("/registry/patches/".length);
        const artifact = registryArtifacts.artifacts.find((entry) => entry.fileName === fileName);
        if (!artifact) {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: "Patch not found" }));
          return;
        }
        response.end(artifact.raw);
      } catch (error) {
        next(error as Error);
      }
    });
  },
  async closeBundle() {
    const { artifacts, registry } = await loadRegistryArtifacts();
    const registryDir = resolve(siteOut, "registry");
    const patchDir = resolve(registryDir, "patches");
    const downloadDir = resolve(siteOut, "downloads");
    await mkdir(patchDir, { recursive: true });
    await mkdir(downloadDir, { recursive: true });
    await Promise.all(artifacts.map((artifact) => copyFile(artifact.sourcePath, resolve(patchDir, artifact.fileName))));
    await Promise.all(releaseFiles.map((fileName) => copyFile(resolve(root, "release", fileName), resolve(downloadDir, fileName))));
    await writeFile(resolve(registryDir, "index.json"), JSON.stringify(registry, null, 2));
  }
};

export default defineConfig({
  root: resolve(root, "src/site"),
  publicDir: resolve(__dirname, "public"),
  plugins: [registryPlugin],
  build: {
    outDir: siteOut,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(root, "src/site/index.html"),
        demo: resolve(root, "src/site/demo/index.html"),
        care: resolve(root, "src/site/care/index.html")
      }
    }
  }
});
