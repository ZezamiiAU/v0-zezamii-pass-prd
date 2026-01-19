"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { notFound } from "next/navigation"
import { PassPurchaseForm } from "@/components/pass-purchase-form"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface PassType {
  id: string
  name: string
  price_cents: number
  currency: string
  description?: string
  duration_minutes?: number
  code?: string
}

interface AccessPointData {
  organizationId: string
  organizationName: string
  organizationLogo?: string | null
  siteId?: string
  siteName: string
  deviceId: string
  deviceName: string
  deviceDescription?: string | null
  passTypes?: PassType[]
}

export default function DevicePassPage() {
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [accessPointData, setAccessPointData] = useState<AccessPointData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedPassTypeId, setSelectedPassTypeId] = useState<string | null>(null)
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

  const formatPrice = (priceCents: number, currency = "AUD"): string => {
    const price = priceCents / 100
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency,
    }).format(price)
  }

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
    const passTypes = accessPointData.passTypes || []

    const handlePassClick = (passTypeId: string) => {
      setSelectedPassTypeId(passTypeId)
      setShowPurchaseForm(true)
    }

    return (
      <main className="min-h-screen bg-[#002147] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="w-full h-40 relative">
              <Image src="/images/image.png" alt="Lake Wyangan" fill className="object-cover" priority />
            </div>

            <div className="p-6 pb-6 space-y-4">
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold text-[#002147]">Griffith Boat Club</h1>
                <p className="text-base text-gray-600">Lake Wyangan</p>
              </div>

              {passTypes.length > 0 ? (
                <div className="space-y-3">
                  {passTypes.map((passType) => (
                    <button
                      key={passType.id}
                      onClick={() => handlePassClick(passType.id)}
                      className="w-full p-4 rounded-xl border-2 transition-all duration-200 text-left border-gray-200 hover:border-[#002147] hover:shadow-md cursor-pointer"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-[#002147]">{passType.name}</p>
                          {passType.description && <p className="text-sm text-gray-500 mt-1">{passType.description}</p>}
                        </div>
                        <p className="text-lg font-bold text-[#002147]">
                          {formatPrice(passType.price_cents, passType.currency)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xl font-semibold text-[#002147]">Day Pass — $25</p>
                </div>
              )}

              <div className="flex justify-center py-2">
                <img src="/images/griffith-boat-club-logo.jpg" alt="Griffith Boat Club" className="h-28 w-auto" />
              </div>

              <div className="pt-2">
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
    <main className="min-h-screen bg-[#002147] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <PassPurchaseForm
          organizationId={accessPointData.organizationId}
          organizationName={accessPointData.organizationName}
          organizationLogo={accessPointData.organizationLogo}
          siteId={accessPointData.siteId}
          siteName={accessPointData.siteName}
          deviceId={accessPointData.deviceId}
          deviceName={accessPointData.deviceName}
          deviceDescription={accessPointData.deviceDescription}
          preSelectedPassTypeId={selectedPassTypeId || undefined}
        />
      </div>
    </main>
  )
}
