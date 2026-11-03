import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "off",
  },
  webServer: [
    {
      command:
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../Backend/scripts/Start-E2EBackend.ps1 -GoogleMock",
      url: "http://127.0.0.1:18080/api/v1/health",
      reuseExistingServer: false,
      timeout: 90_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command:
        "npm.cmd run preview -- --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 30_000,
      env: { TINYCLASS_API_PROXY_TARGET: "http://127.0.0.1:18080" },
    },
  ],
});
