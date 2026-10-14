import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ekoo",
    short_name: "ekoo",
    description: "Join an activity or help a neighbour within 3 km.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F1F3F0",
    theme_color: "#F1F3F0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
