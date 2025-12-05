"use client"

import { useEffect, useState, useCallback } from "react"

interface ServiceWorkerState {
  registration: ServiceWorkerRegistration | null
  updateAvailable: boolean
  error: Error | null
}

const SW_UPDATE_EVENT = "sw-update-available"

export function ServiceWorkerRegistration() {
  const [swState, setSwState] = useState<ServiceWorkerState>({
    registration: null,
    updateAvailable: false,
    error: null,
  })

  const triggerUpdate = useCallback(() => {
    if (swState.registration?.waiting) {
      swState.registration.waiting.postMessage("skipWaiting")
    }
  }, [swState.registration])

  useEffect(() => {
    // Only register in production or on HTTPS
    const isV0Preview =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("vusercontent.net") || window.location.hostname.includes("v0.dev"))

    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || window.location.hostname === "localhost") &&
      !isV0Preview
    ) {
      // Register service worker after page load
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js")

          setSwState((prev) => ({ ...prev, registration }))

          // Check for updates periodically
          const updateInterval = setInterval(
            () => {
              registration.update().catch((err) => {
                console.warn("SW update check failed:", err)
              })
            },
            60 * 60 * 1000,
          ) // Check every hour

          // Handle updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  setSwState((prev) => ({ ...prev, updateAvailable: true }))
                  window.dispatchEvent(
                    new CustomEvent(SW_UPDATE_EVENT, {
                      detail: { triggerUpdate },
                    }),
                  )
                  console.info("[SW] New version available. Refresh to update.")
                }
              })
            }
          })

          let refreshing = false
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return
            refreshing = true
            window.location.reload()
          })

          // Cleanup on unmount
          return () => {
            clearInterval(updateInterval)
          }
        } catch (error) {
          console.error("Service worker registration failed:", error)
          setSwState((prev) => ({
            ...prev,
            error: error instanceof Error ? error : new Error(String(error)),
          }))
        }
      }

      if (document.readyState === "complete") {
        registerSW()
      } else {
        window.addEventListener("load", registerSW)
        return () => window.removeEventListener("load", registerSW)
      }
    }
  }, [triggerUpdate])

  return null
}

export { SW_UPDATE_EVENT }
export type { ServiceWorkerState }
