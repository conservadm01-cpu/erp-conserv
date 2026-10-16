"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui/Button";

export function LogoutButton({ variant = "ghost", className = "" }: { variant?: "ghost" | "secondary"; className?: string }) {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }
  return (
    <Button variant={variant} onClick={logout} loading={busy} className={className}>
      Sair
    </Button>
  );
}
