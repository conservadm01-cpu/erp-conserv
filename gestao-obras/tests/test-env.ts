import "dotenv/config";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://obras:obras_dev@localhost:5432/obras_test?schema=public";
