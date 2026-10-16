import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession, STATE_ROUTES } from "@/server/auth/page-context";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const current = await currentSession();
  if (current) redirect(current.state === "OK" ? "/" : STATE_ROUTES[current.state]);
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}
