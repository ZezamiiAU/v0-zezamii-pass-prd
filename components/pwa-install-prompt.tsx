"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Download } from "lucide-react"

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [appTitle, setAppTitle] = useState("Zezamii Pass")

  useEffect(() => {
    const title = process.env.NEXT_PUBLIC_APP_TITLE || "Zezamii Pass"
    setAppTitle(title)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)

      const dismissed = localStorage.getItem("pwa-install-dismissed")
      if (!dismissed) {
        setShowPrompt(true)
      }
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("pwa-install-dismissed", "true")
  }

  if (!showPrompt) return null

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 p-4 shadow-lg border-2 border-[#0CA3C1] bg-white">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[#6ADFF6] to-[#0CA3C1] rounded-lg flex items-center justify-center">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Install {appTitle}</h3>
          <p className="text-xs text-gray-600 mb-3">Add to your home screen for quick access and offline support</p>
          <div className="flex gap-2">
            <Button onClick={handleInstall} size="sm" className="bg-[#0CA3C1] hover:bg-[#0B1E3D]">
              Install
            </Button>
            <Button onClick={handleDismiss} size="sm" variant="outline">
              Not now
            </Button>
          </div>
        </div>
        <button onClick={handleDismiss} className="flex-shrink-0 text-gray-400 hover:text-gray-600" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>
    </Card>
  )
}
