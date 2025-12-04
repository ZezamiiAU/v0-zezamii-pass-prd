"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { notFound } from "next/navigation"
import { PassPurchaseForm } from "@/components/pass-purchase-form"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface AccessPointData {
  organizationId: string
  organizationName: string
  organizationLogo?: string | null
  siteId?: string
  siteName: string
  deviceId: string
  deviceName: string
  deviceDescription?: string | null
}

export default function DevicePassPage() {
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [accessPointData, setAccessPointData] = useState<AccessPointData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchAccessPoint() {
      try {
        const response = await fetch(window.location.pathname + "/api" + window.location.search)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to load access point")
        }

        const data = await response.json()
        setAccessPointData(data)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        setLoading(false)
      }
    }

    fetchAccessPoint()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (error || !accessPointData) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Access Point</h1>
          <p>{error || "Access point not found"}</p>
          <Button onClick={() => router.push("/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </main>
    )
  }

  if (!showPurchaseForm) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center px-4">
        <div className="absolute top-[15%]">
          <Image
            src="/images/zezamii-pass-logo.png"
            alt="Zezamii Pass"
            width={400}
            height={120}
            priority
            className="object-contain"
          />
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">Day Pass</h1>
            <p className="text-xl text-slate-300">{accessPointData.deviceName}</p>
            <p className="text-lg text-slate-400">{accessPointData.siteName}</p>
          </div>

          <Button
            onClick={() => setShowPurchaseForm(true)}
            className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            Buy Pass
          </Button>
        </div>

        <footer className="absolute bottom-8 text-center text-slate-400 text-sm">Powered by Zezamii</footer>
      </main>
    )
  }

  if (!accessPointData?.siteId) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <PassPurchaseForm
        organizationId={accessPointData.organizationId}
        organizationName={accessPointData.organizationName}
        organizationLogo={accessPointData.organizationLogo}
        siteId={accessPointData.siteId}
        siteName={accessPointData.siteName}
        deviceId={accessPointData.deviceId}
        deviceName={accessPointData.deviceName}
        deviceDescription={accessPointData.deviceDescription}
      />
    </main>
  )
}
