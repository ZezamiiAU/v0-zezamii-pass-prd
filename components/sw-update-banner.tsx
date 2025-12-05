"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, X } from "lucide-react"
import { SW_UPDATE_EVENT } from "@/components/service-worker-registration"

export function SWUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [triggerUpdate, setTriggerUpdate] = useState<(() => void) | null>(null)

  useEffect(() => {
    const handleUpdate = (event: CustomEvent<{ triggerUpdate: () => void }>) => {
      setShowBanner(true)
      setTriggerUpdate(() => event.detail.triggerUpdate)
    }

    window.addEventListener(SW_UPDATE_EVENT, handleUpdate as EventListener)
    return () => {
      window.removeEventListener(SW_UPDATE_EVENT, handleUpdate as EventListener)
    }
  }, [])

  const handleRefresh = () => {
    if (triggerUpdate) {
      triggerUpdate()
    } else {
      window.location.reload()
    }
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-brand-primary text-white rounded-lg shadow-lg p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">A new version is available</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRefresh}
            className="bg-white text-brand-primary hover:bg-gray-100"
          >
            Update
          </Button>
          <button onClick={() => setShowBanner(false)} className="p-1 hover:bg-white/20 rounded" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
