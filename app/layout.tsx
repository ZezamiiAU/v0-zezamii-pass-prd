import type React from "react"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { OfflineToast } from "@/components/offline-toast"
import { PoweredByZezamii } from "@/components/powered-by-zezamii"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { SWUpdateBanner } from "@/components/sw-update-banner"

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
  manifest: "/api/manifest",
  generator: "v0.app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: appTitle,
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: "#0B1E3D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <head>
        <link rel="icon" type="image/jpeg" sizes="192x192" href="/icon-192.jpg" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.jpg" />
      </head>
      <body className={`${inter.className} h-full overflow-hidden`}>
        <div className="h-screen flex flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          <PoweredByZezamii />
        </div>
        <PWAInstallPrompt />
        <OfflineToast />
        <ServiceWorkerRegistration />
        <SWUpdateBanner />
      </body>
    </html>
  )
}
