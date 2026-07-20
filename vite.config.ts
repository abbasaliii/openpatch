import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import type { RegistryCompatibilityReport } from "./src/core/compatibility";
import { canonicalPatchSource } from "./src/core/patch-source";
import { validatePatch } from "./src/core/validator";

const root = __dirname;
const siteOut = resolve(root, "dist/site");
const patchSourceDir = resolve(root, "src/registry/patches");
const compatibilitySourcePath = resolve(root, "src/registry/compatibility.json");
const releaseFiles = ["openpatch-extension-v0.7.0.zip", "openpatch-codex-plugin-v0.4.0.zip"];

async function loadRegistryArtifacts() {
  const compatibilityReport = JSON.parse(await readFile(compatibilitySourcePath, "utf8")) as RegistryCompatibilityReport;
  if (compatibilityReport.schemaVersion !== 1 || !Array.isArray(compatibilityReport.patches)) {
    throw new Error("Registry compatibility baseline is malformed.");
  }
  const patchFiles = (await readdir(patchSourceDir)).filter((file) => file.endsWith(".openpatch.json")).sort();
  const artifacts = await Promise.all(patchFiles.map(async (fileName) => {
    const sourcePath = resolve(patchSourceDir, fileName);
    const raw = canonicalPatchSource(await readFile(sourcePath, "utf8"));
    const validation = validatePatch(JSON.parse(raw) as unknown);
    if (!validation.ok) throw new Error(`${fileName} failed registry policy validation: ${validation.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
    const patch = validation.patch;
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const compatibility = compatibilityReport.patches.find((entry) =>
      entry.id === patch.id && entry.version === patch.version && entry.patchSha256 === sha256
    );
    if (!compatibility) throw new Error(`${fileName} has no current compatibility receipt. Run npm run monitor:registry -- src/registry/compatibility.json.`);
    return { fileName, raw, patch, sha256, compatibility };
  }));
  const registry = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    patches: artifacts.map(({ fileName, patch, sha256, compatibility }) => ({
      id: patch.id,
      name: patch.name,
      summary: patch.summary,
      version: patch.version,
      author: patch.author,
      scope: patch.match,
      capabilities: patch.capabilities,
      download: `/registry/patches/${fileName}`,
      sha256,
      verification: {
        status: "verified",
        operations: patch.operations.length,
        assertions: patch.verify.length
      },
      compatibility: {
        status: compatibility.status,
        checkedAt: compatibility.checkedAt,
        pageUrl: compatibility.pageUrl,
        patchSha256: compatibility.patchSha256,
        healthy: compatibility.healthy,
        total: compatibility.total,
        fingerprint: compatibility.fingerprint,
        driftedOperationIds: compatibility.driftedOperationIds
      },
      changelog: patch.changelog
    }))
  };
  return { artifacts, registry, compatibilityReport };
}

const registryPlugin: Plugin = {
  name: "openpatch-public-registry",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = request.url?.split("?", 1)[0];
      if (pathname !== "/registry/index.json" && pathname !== "/registry/compatibility.json" && !pathname?.startsWith("/registry/patches/")) return next();
      try {
        const registryArtifacts = await loadRegistryArtifacts();
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        if (pathname === "/registry/index.json") {
          response.end(JSON.stringify(registryArtifacts.registry, null, 2));
          return;
        }
        if (pathname === "/registry/compatibility.json") {
          response.end(JSON.stringify(registryArtifacts.compatibilityReport, null, 2));
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
    const { artifacts, registry, compatibilityReport } = await loadRegistryArtifacts();
    const registryDir = resolve(siteOut, "registry");
    const patchDir = resolve(registryDir, "patches");
    const downloadDir = resolve(siteOut, "downloads");
    await mkdir(patchDir, { recursive: true });
    await mkdir(downloadDir, { recursive: true });
    await Promise.all(artifacts.map((artifact) => writeFile(resolve(patchDir, artifact.fileName), artifact.raw, "utf8")));
    await Promise.all(releaseFiles.map((fileName) => copyFile(resolve(root, "release", fileName), resolve(downloadDir, fileName))));
    await writeFile(resolve(registryDir, "index.json"), JSON.stringify(registry, null, 2));
    await writeFile(resolve(registryDir, "compatibility.json"), `${JSON.stringify(compatibilityReport, null, 2)}\n`);
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
        care: resolve(root, "src/site/care/index.html"),
        sentinel: resolve(root, "src/site/sentinel/index.html")
      }
    }
  }
});
