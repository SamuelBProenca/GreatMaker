import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, retries: 0, timeout: 60000,
  expect: { timeout: 10000 }, reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3100", channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "win32" ? "msedge" : undefined), headless: true, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { viewport: { width: 1440, height: 1000 } } }, { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: {
    command: process.env.E2E_DEV === "1" ? "pnpm dev --port 3100" : "pnpm start --port 3100",
    url: "http://127.0.0.1:3100", reuseExistingServer: false, timeout: 120000,
    env: { APP_ORIGIN: "http://127.0.0.1:3100", DESIGNREF_DATA_DIR: resolve("data/e2e"), NEXT_TELEMETRY_DISABLED: "1" }
  }
});
