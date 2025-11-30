import { NextResponse } from "next/server"
import { getBrandingConfig } from "@/lib/config/branding"

export async function GET() {
  // For homepage, use default branding
  // In the future, could accept query params for org-specific manifest
  const branding = await getBrandingConfig()

  const manifest = {
    name: branding.manifestName,
    short_name: branding.manifestShortName,
    description: branding.manifestDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#0B1E3D",
    theme_color: "#0B1E3D",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  }

  return NextResponse.json(manifest)
}
