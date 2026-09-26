import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4179",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm start",
    url: "http://127.0.0.1:4179/readyz",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: "4179",
      DATA_DIR: join(tmpdir(), `mantooth-tasks-e2e-${process.pid}`),
    },
  },
});
