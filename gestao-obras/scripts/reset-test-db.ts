/**
 * Recria o esquema do banco de TESTES e aplica as migrações.
 * Recusa-se a executar se o nome do banco não terminar em "_test".
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

export async function resetTestDatabase(url: string) {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(`Recusado: o banco "${dbName}" não parece ser de testes (o nome deve terminar em _test).`);
  }
  // Cria o banco de testes se ainda não existir (requer permissão CREATEDB).
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const server = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  try {
    const rows = await server.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_database WHERE datname = ${dbName}`;
    if (rows[0]?.n === 0) await server.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await server.$disconnect();
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  } finally {
    await prisma.$disconnect();
  }
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}

if (process.argv[1]?.endsWith("reset-test-db.ts")) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Defina TEST_DATABASE_URL.");
  resetTestDatabase(url).then(() => console.log("Banco de testes recriado."));
}
