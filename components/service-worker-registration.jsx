"use client"

import { useEffect, useState, useCallback } from "react"

export function useServiceWorker() {
  const [registration, setRegistration] = useState(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [swVersion, setSwVersion] = useState(null)

  const checkForUpdate = useCallback(async () => {
    if (registration) {
      await registration.update()
    }
  }, [registration])

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage("skipWaiting")
    }
  }, [registration])

  const clearCache = useCallback(async () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage("clearCache")
    }
  }, [])

  const getVersion = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.serviceWorker.controller) {
        resolve(null)
        return
      }
      const channel = new MessageChannel()
      channel.port1.onmessage = (event) => resolve(event.data)
      navigator.serviceWorker.controller.postMessage("getVersion", [channel.port2])
      setTimeout(() => resolve(null), 1000)
    })
  }, [])

  useEffect(() => {
    getVersion().then(setSwVersion)
  }, [getVersion, registration])

  return {
    registration,
    setRegistration,
    updateAvailable,
    setUpdateAvailable,
    swVersion,
    checkForUpdate,
    applyUpdate,
    clearCache,
  }
}

function isPreviewEnvironment() {
  if (typeof window === "undefined") return false
  const hostname = window.location.hostname
  return (
    hostname.includes("vusercontent.net") ||
    hostname.includes("v0.dev") ||
    (hostname.includes("vercel.app") && hostname.includes("preview"))
  )
}

export function ServiceWorkerRegistration() {
  const { setRegistration, setUpdateAvailable } = useServiceWorker()

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      (window.location.protocol !== "https:" && window.location.hostname !== "localhost")
    ) {
      return
    }

    if (isPreviewEnvironment()) {
      console.log("[SW] Skipping registration in preview environment")
      return
    }

    let refreshing = false

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    const registerSW = async () => {
      const swPaths = ["/sw.js", "/api/sw"]

      for (const swPath of swPaths) {
        try {
          // First check if the path returns JavaScript
          const response = await fetch(swPath, { method: "HEAD" })
          const contentType = response.headers.get("content-type") || ""

          if (!contentType.includes("javascript")) {
            console.log(`[SW] ${swPath} returned ${contentType}, trying next...`)
            continue
          }

          const reg = await navigator.serviceWorker.register(swPath, {
            scope: "/",
            updateViaCache: "none",
          })

          setRegistration(reg)
          console.log(`[SW] Registered successfully from ${swPath}`)

          if (reg.waiting) {
            setUpdateAvailable(true)
          }

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing
            if (!newWorker) return

            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateAvailable(true)
                console.info("[SW] New version available. Refresh to update.")
                window.dispatchEvent(new CustomEvent("sw-update-available"))
              }
            })
          })

          const updateInterval = setInterval(
            () => {
              reg.update().catch(console.error)
            },
            15 * 60 * 1000,
          )

          const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
              reg.update().catch(console.error)
            }
          }
          document.addEventListener("visibilitychange", handleVisibilityChange)

          // Successfully registered, exit the loop
          return () => {
            clearInterval(updateInterval)
            document.removeEventListener("visibilitychange", handleVisibilityChange)
          }
        } catch (error) {
          console.warn(`[SW] Failed to register from ${swPath}:`, error.message)
        }
      }

      console.error("[SW] All registration attempts failed")
    }

    if (document.readyState === "complete") {
      registerSW()
    } else {
      window.addEventListener("load", registerSW)
      return () => window.removeEventListener("load", registerSW)
    }
  }, [setRegistration, setUpdateAvailable])

  return null
}
