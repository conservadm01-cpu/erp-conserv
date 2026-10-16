import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://obras:obras_dev@localhost:5432/obras_e2e_test?schema=public";
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "pt-BR" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsivo\.spec\.ts/ },
    { name: "celular", use: { ...devices["Pixel 7"] }, testMatch: /responsivo\.spec\.ts/ },
  ],
  webServer: {
    command: `npx tsx tests/e2e/prepare-db.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      APP_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
      MAIL_DRIVER: "console",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
