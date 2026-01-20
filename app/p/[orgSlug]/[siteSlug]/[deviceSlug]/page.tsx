"use client"

import { useState, useEffect, useCallback } from "react"
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
  const [logoError, setLogoError] = useState(false)
  const router = useRouter()

  const handleLogoError = useCallback(() => {
    setLogoError(true)
  }, [])

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

  const formatPrice = (priceCents: number, currency?: string): string => {
    const price = priceCents / 100
    const validCurrency = currency && currency.length === 3 ? currency.toUpperCase() : "AUD"
    try {
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: validCurrency,
      }).format(price)
    } catch {
      return `$${price.toFixed(2)} ${validCurrency}`
    }
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
      <main className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#1e293b]">
        {/* Prominent Top Header - 64px for Landing Page */}
        <div className="fixed top-0 left-0 right-0 h-16 bg-[#020617] flex items-center justify-center px-4 z-50 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/zezamii-logo.png" alt="Zezamii" className="w-8 h-8 rounded" />
            <span className="text-white font-bold text-lg uppercase tracking-[0.1em]">Zezamii Pass</span>
          </div>
        </div>

        {/* Content with top padding for 64px header + 24px gap */}
        <div className="pt-[88px] px-4 pb-8 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md">

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Hero Image - 180px compact */}
            <div className="w-full h-[180px] relative">
              <Image src="/images/image.png" alt={accessPointData.siteName} fill className="object-cover" priority />
            </div>

            <div className="p-5 space-y-4">
              {/* Organization Logo & Name */}
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full border border-gray-200 p-1.5 bg-white flex items-center justify-center">
                    <img
                      src={accessPointData.organizationLogo && !logoError ? accessPointData.organizationLogo : "/images/griffith-boat-club-logo.png"}
                      alt={accessPointData.organizationName}
                      className="w-full h-full object-contain rounded-full"
                      onError={handleLogoError}
                    />
                  </div>
                </div>
                <h1 className="text-xl font-bold text-[#002147]">{accessPointData.organizationName}</h1>
              </div>

              {/* Pass Types */}
              {passTypes.length > 0 ? (
                <div className="space-y-2">
                  {passTypes.map((passType) => (
                    <button
                      key={passType.id}
                      onClick={() => handlePassClick(passType.id)}
                      className="w-full p-3 rounded-xl border border-slate-200 transition-all duration-200 text-left hover:border-[#020617] hover:shadow-sm hover:shadow-[#020617]/10 cursor-pointer"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-[#020617] tracking-tight">{passType.name}</p>
                          {passType.description && <p className="text-sm text-slate-500 mt-0.5">{passType.description}</p>}
                        </div>
                        <p className="text-lg font-bold text-[#020617]">
                          {formatPrice(passType.price_cents, passType.currency)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xl font-bold text-[#020617] tracking-tight">Day Pass</p>
                </div>
              )}

              {/* Buy Button */}
              <div className="pt-2">
                <Button
                  onClick={() => setShowPurchaseForm(true)}
                  className="w-full h-11 text-sm font-bold uppercase bg-[#020617] hover:bg-[#0f172a] text-white shadow-sm transition-all duration-300 rounded-xl"
                  size="lg"
                >
                  Buy Pass
                </Button>
              </div>
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
    <main className="min-h-screen bg-[#002147] overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center px-4 py-6">
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
      </div>
    </main>
  )
}
