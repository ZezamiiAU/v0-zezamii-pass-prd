import { NextResponse } from "next/server"
import { getBrandingConfig } from "@/lib/config/branding"

export async function GET() {
  const branding = await getBrandingConfig()

  const manifest = {
    id: "/",
    name: branding.manifestName,
    short_name: branding.manifestShortName,
    description: branding.manifestDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B1E3D",
    theme_color: "#0B1E3D",
    orientation: "portrait",
    categories: ["business", "utilities"],
    icons: [
      {
        src: "/icon-192.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/icon-512.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.jpg",
        sizes: "180x180",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
    screenshots: [],
    prefer_related_applications: false,
  }

  return NextResponse.json(manifest)
}
