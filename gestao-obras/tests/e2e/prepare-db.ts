/**
 * Recria e popula o banco E2E. Executado pelo comando do webServer do
 * Playwright, que sobe antes do globalSetup.
 */
import { execSync } from "node:child_process";
import { resetTestDatabase } from "../../scripts/reset-test-db";

const url = process.env.DATABASE_URL!;
resetTestDatabase(url).then(() => {
  execSync("npx tsx prisma/seed.ts", { env: { ...process.env, SEED_MODE: "demo", NODE_ENV: "development" }, stdio: "inherit" });
});
