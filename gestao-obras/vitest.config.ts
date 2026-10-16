import { defineConfig } from "vitest/config";
import path from "node:path";
import { TEST_DATABASE_URL } from "./tests/test-env";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    // Os testes de integração compartilham o banco de testes; execução sequencial evita interferência.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      APP_URL: "http://localhost:3000",
      MAIL_DRIVER: "memory",
      APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    },
  },
});
