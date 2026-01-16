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
          <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
            <div className="flex justify-center">
              <Image
                src="https://griffithboatclub.com/wp-content/uploads/2024/03/cropped-GBC-LOGO-3-1.png"
                alt="Griffith Boat Club"
                width={200}
                height={80}
                priority
                className="object-contain"
              />
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold text-[#002147]">Day Pass</h1>
              <p className="text-base text-gray-600">
                {accessPointData.deviceName} — {accessPointData.siteName}
              </p>
            </div>

            <div className="flex justify-center py-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-slate-400"
              >
                <path
                  d="M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41C3.37 14.2 4.63 14.2 5.41 13.41L6 12.83V21C6 21.55 6.45 22 7 22H11V16H13V22H17C17.55 22 18 21.55 18 21V12.83L18.59 13.41C19.37 14.2 20.63 14.2 21.41 13.41C22.2 12.63 22.2 11.37 21.41 10.59L13.41 2.59C13 2.19 12.5 2 12 2Z"
                  fill="currentColor"
                  opacity="0.6"
                />
              </svg>
            </div>

            <Button
              onClick={() => setShowPurchaseForm(true)}
              className="w-full h-14 text-lg font-bold uppercase bg-[#002147] hover:bg-[#003366] text-white shadow-lg hover:shadow-xl transition-all duration-300"
              size="lg"
            >
              Buy Pass
            </Button>
          </div>

          <footer className="text-center text-gray-300 text-sm mt-6">Powered by Zezamii</footer>
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
