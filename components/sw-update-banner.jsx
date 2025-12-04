"use client"

import { useState, useEffect } from "react"
import { RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SWUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setShowBanner(true)
    }

    window.addEventListener("sw-update-available", handleUpdateAvailable)
    return () => window.removeEventListener("sw-update-available", handleUpdateAvailable)
  }, [])

  const handleRefresh = () => {
    // Tell waiting SW to take over
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.waiting?.postMessage("skipWaiting")
      })
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium">A new version is available</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleRefresh}>
            Update
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
