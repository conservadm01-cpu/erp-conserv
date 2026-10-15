import type { Metadata, Viewport } from "next";
import "./globals.css";

// Todas as páginas são renderizadas por requisição para receber o nonce da CSP.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Gestão de Obras", template: "%s · Gestão de Obras" },
  description: "Sistema de gestão de obras — proposta técnica independente.",
  applicationName: "Gestão de Obras",
};

export const viewport: Viewport = {
  themeColor: "#1c4878",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
