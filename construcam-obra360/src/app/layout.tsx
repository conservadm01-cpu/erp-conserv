import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Construcam Obra 360",
  description: "Acompanhamento audiovisual de reformas residenciais.",
  applicationName: "Construcam",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Construcam" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef2f6"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
