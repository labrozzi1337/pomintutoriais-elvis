import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e", timeout: 60_000, workers: 1,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8081", browserName: "chromium", trace: "off" },
  reporter: "list"
});
