import { defineConfig } from "vitest/config";

export default defineConfig({
  root: __dirname,
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "jsdom",
    restoreMocks: true,
    pool: "threads",
    maxWorkers: 1
  }
});
