import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BDM CRM",
    short_name: "CRM",
    description: "Customer Relationship Management System",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#84cc16", // Lime-500
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
