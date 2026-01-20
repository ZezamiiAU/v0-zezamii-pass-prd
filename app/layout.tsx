import type React from "react"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { OfflineToast } from "@/components/offline-toast"
import { PoweredByZezamii } from "@/components/powered-by-zezamii"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { SWUpdateBanner } from "@/components/sw-update-banner"

import { Geist, Geist_Mono } from "next/font/google"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

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
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/jpeg" sizes="192x192" href="/icon-192.jpg" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.jpg" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>
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
