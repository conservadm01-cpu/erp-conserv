import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "@/components/layout/providers";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: { default: "VIAJAR+ — seu guia e diário de viagem", template: "%s · VIAJAR+" },
  description: "Planeje viagens, compare preços, controle o orçamento e crie o book da viagem com fotos e vídeos.",
  manifest: "/manifest.webmanifest",
  applicationName: "VIAJAR+",
  appleWebApp: { capable: true, title: "VIAJAR+", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1419" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
