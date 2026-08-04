import { defineConfig, devices } from "@playwright/test";

/**
 * Drives the real Next.js dev server against the real FastAPI backend
 * (DATA_BACKEND=local, in-memory — see backend/README.md), not mocks.
 * `workers: 1` because that in-memory store is shared, process-wide state:
 * concurrent tests would race on the same Signups/Volunteers/Donors data.
 * See specs/features/011-volunteer-application-approval/tasks.md, whose
 * "Manual test (frontend)" bullets this suite automates.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "ENV=dev DATA_BACKEND=local API_PUBLIC_BASE_URL=http://localhost:8001/api " +
        "ADMIN_EMAILS=vganeshkumar@gmail.com ENABLE_DUMMY_LOGIN=true " +
        "uv run uvicorn app.main:app --port 8001",
      cwd: "../backend",
      url: "http://localhost:8001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
