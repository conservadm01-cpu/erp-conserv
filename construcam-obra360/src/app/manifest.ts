import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Construcam Obra 360",
    short_name: "Construcam",
    description: "Gravação e acompanhamento de reformas",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef2f6",
    theme_color: "#0f2a42",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
