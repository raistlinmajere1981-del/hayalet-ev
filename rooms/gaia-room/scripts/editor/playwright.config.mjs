import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.browser.spec.mjs",
  outputDir: "../../../.build/gaia-room/test-results",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4177",
    viewport: { width: 1350, height: 850 },
  },
  webServer: {
    command: "vite preview --mode acceptance --host 127.0.0.1 --port 4177 --strictPort",
    url: "http://127.0.0.1:4177",
    reuseExistingServer: false,
  },
});
