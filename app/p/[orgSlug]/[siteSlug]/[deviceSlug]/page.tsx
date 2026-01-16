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
      <main className="min-h-screen bg-[#002147] flex items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (error || !accessPointData) {
    return (
      <main className="min-h-screen bg-[#002147] flex items-center justify-center px-4">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Access Point</h1>
          <p className="mb-4">{error || "Access point not found"}</p>
          <Button onClick={() => router.push("/")} className="mt-4 bg-white text-[#002147] hover:bg-gray-100">
            Go Home
          </Button>
        </div>
      </main>
    )
  }

  if (!showPurchaseForm) {
    return (
      <main className="min-h-screen bg-[#002147] flex items-center justify-center px-4 py-8">
        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .fade-in {
            animation: fadeIn 0.6s ease-out;
          }
        `}</style>

        <div className="w-full max-w-md fade-in">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="w-full h-40 relative">
              <Image src="/images/image.png" alt="Lake Wyangan" fill className="object-cover" priority />
            </div>

            <div className="p-6 pb-6 space-y-4">
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold text-[#002147]">Griffith Boat Club</h1>
                <p className="text-base text-gray-600">Lake Wyangan</p>
              </div>

              <div className="text-center">
                <p className="text-xl font-semibold text-[#002147]">Day Pass — $25</p>
              </div>

              <div className="flex flex-col items-center gap-4" style={{ minHeight: "120px" }}>
                <Image
                  src="https://griffithboatclub.com.au/wp-content/uploads/2023/02/logo.png"
                  alt="Griffith Boat Club"
                  width={144}
                  height={144}
                  priority
                  className="object-contain h-36"
                />

                <Button
                  onClick={() => setShowPurchaseForm(true)}
                  className="w-full h-14 text-lg font-bold uppercase bg-[#002147] hover:bg-[#003366] text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  size="lg"
                >
                  Buy Pass
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!accessPointData?.siteId) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[#002147]">
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
