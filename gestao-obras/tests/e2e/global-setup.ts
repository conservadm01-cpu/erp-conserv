import { execSync } from "node:child_process";
import { resetTestDatabase } from "../../scripts/reset-test-db";
import { E2E_DATABASE_URL } from "../../playwright.config";

export default async function setup() {
  await resetTestDatabase(E2E_DATABASE_URL);
  execSync("npx tsx prisma/seed.ts", { env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, SEED_MODE: "demo", NODE_ENV: "development" }, stdio: "pipe" });
}
