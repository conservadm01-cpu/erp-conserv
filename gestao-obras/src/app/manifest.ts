import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestão de Obras",
    short_name: "Obras",
    description: "Gestão de obras — proposta técnica independente.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1c4878",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
