import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "src/site"),
  publicDir: resolve(__dirname, "public"),
  build: {
    outDir: resolve(__dirname, "dist/site"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(__dirname, "src/site/index.html"),
        demo: resolve(__dirname, "src/site/demo/index.html")
      }
    }
  }
});
