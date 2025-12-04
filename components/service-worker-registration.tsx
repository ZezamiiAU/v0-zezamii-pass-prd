"use client"

import { useEffect } from "react"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register in production or on HTTPS
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || window.location.hostname === "localhost")
    ) {
      // Register service worker after page load
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            // Check for updates periodically
            setInterval(
              () => {
                registration.update()
              },
              60 * 60 * 1000,
            ) // Check every hour

            // Handle updates
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    // New content is available, could prompt user to refresh
                    console.info("New version available. Refresh to update.")
                  }
                })
              }
            })
          })
          .catch((error) => {
            console.error("Service worker registration failed:", error)
          })
      })
    }
  }, [])

  return null
}
