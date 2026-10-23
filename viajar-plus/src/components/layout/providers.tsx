"use client";
import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { TripProvider } from "@/lib/trips/context";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ToastProvider>
        <TripProvider>{children}</TripProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
