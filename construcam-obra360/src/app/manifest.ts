import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Construcam Obra 360",
    short_name: "Construcam",
    description: "Acompanhamento e documentação de reformas",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#102a43",
    icons: []
  };
}
