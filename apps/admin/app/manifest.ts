import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qelp",
    short_name: "Qelp",
    description: "AI-powered bug reporting and feedback platform for agencies and SaaS teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4eee3",
    theme_color: "#0f766e"
  };
}
