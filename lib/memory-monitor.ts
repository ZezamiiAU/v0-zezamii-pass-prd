export interface MemorySnapshot {
  timestamp: number
  route: string
  jsHeapSize?: number
  jsHeapSizeLimit?: number
  usedJSHeapSize?: number
  swState?: string
  clientsCount?: number
  cacheReport?: Array<{ name: string; entries: number; bytes: number }>
}

class MemoryMonitor {
  private snapshots: MemorySnapshot[] = []
  private interval: NodeJS.Timeout | null = null
  private enabled = false

  start() {
    if (this.enabled || typeof window === "undefined") return
    this.enabled = true

    // Sample every 5 seconds
    this.interval = setInterval(() => {
      this.takeSnapshot()
    }, 5000)

    // Request cache usage report
    this.requestCacheReport()

    console.log("[MemoryMonitor] Started")
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.enabled = false
    console.log("[MemoryMonitor] Stopped")
  }

  private takeSnapshot() {
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      route: window.location.pathname,
    }

    // Chrome-specific memory API
    if ("memory" in performance) {
      const mem = (performance as any).memory
      snapshot.jsHeapSize = mem.jsHeapSizeLimit
      snapshot.jsHeapSizeLimit = mem.jsHeapSizeLimit
      snapshot.usedJSHeapSize = mem.usedJSHeapSize
    }

    // Service worker state
    if (navigator.serviceWorker?.controller) {
      snapshot.swState = navigator.serviceWorker.controller.state
    }

    this.snapshots.push(snapshot)

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift()
    }
  }

  private requestCacheReport() {
    if (!navigator.serviceWorker?.controller) return

    navigator.serviceWorker.controller.postMessage({ type: "REPORT_CACHE_USAGE" })

    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "CACHE_USAGE") {
        console.table(e.data.report)

        // Add to latest snapshot
        if (this.snapshots.length > 0) {
          this.snapshots[this.snapshots.length - 1].cacheReport = e.data.report
        }
      }
    })
  }

  getSnapshots() {
    return this.snapshots
  }

  exportCSV() {
    const headers = ["timestamp", "route", "usedJSHeapSize", "jsHeapSizeLimit", "swState"]
    const rows = this.snapshots.map((s) => [
      s.timestamp,
      s.route,
      s.usedJSHeapSize || "",
      s.jsHeapSizeLimit || "",
      s.swState || "",
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `memory-report-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
}

export const memoryMonitor = new MemoryMonitor()

// Auto-start in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  memoryMonitor.start()
}
