import type React from "react"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { OfflineToast } from "@/components/offline-toast"
import { PoweredByZezamii } from "@/components/powered-by-zezamii"

import {
  Inter,
  Inter as V0_Font_Inter,
  Geist_Mono as V0_Font_Geist_Mono,
  Source_Serif_4 as V0_Font_Source_Serif_4,
} from "next/font/google"

const _inter = V0_Font_Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
})
const _geistMono = V0_Font_Geist_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
})
const _sourceSerif_4 = V0_Font_Source_Serif_4({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
})

const inter = Inter({ subsets: ["latin"] })

const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || "Access Pass"
const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || "Quick and easy day pass purchase"

export const metadata: Metadata = {
  title: appTitle,
  description: appDescription,
  manifest: "/api/manifest", // Dynamic manifest route
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#0B1E3D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <head>
        <link rel="icon" href="/icon-192.jpg" />
        <link rel="apple-touch-icon" href="/icon-192.jpg" />
      </head>
      <body className={`${inter.className} h-full overflow-hidden`}>
        <div className="h-screen flex flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          <PoweredByZezamii />
        </div>
        <PWAInstallPrompt />
        <OfflineToast />
      </body>
    </html>
  )
}
