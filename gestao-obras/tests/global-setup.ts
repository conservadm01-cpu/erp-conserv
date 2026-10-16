import { resetTestDatabase } from "../scripts/reset-test-db";
import { TEST_DATABASE_URL } from "./test-env";

export default async function setup() {
  await resetTestDatabase(TEST_DATABASE_URL);
}
