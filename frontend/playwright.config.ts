import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve("..", ".browsers");
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15000 },
  use: { baseURL: "http://127.0.0.1:3001", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "..\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8001",
      url: "http://127.0.0.1:8001/health",
      reuseExistingServer: false,
      env: { DATA_DIR: path.resolve("../.data-e2e") },
      timeout: 60000,
    },
    {
      command: "npm run start -- --port 3001",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: false,
      env: { FASTAPI_URL: "http://127.0.0.1:8001" },
      timeout: 120000,
    },
  ],
});
