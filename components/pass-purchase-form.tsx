"use client"

import { useState, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PaymentForm } from "@/components/payment-form"
import { createPaymentIntent } from "@/lib/api/payments"
import { getOrCreatePaymentAttemptKey, clearPaymentAttempt } from "@/lib/http/idempotency"
import { Check, Anchor } from "lucide-react"
import type { PassType } from "@/lib/db/pass-types"

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
if (!publishableKey) {
  throw new Error("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
}
const stripePromise = loadStripe(publishableKey)

interface PassPurchaseFormProps {
  organizationId: string
  organizationName: string
  organizationLogo?: string | null
  siteId: string
  siteName: string
  deviceId: string
  deviceName: string
  deviceDescription?: string | null
  preSelectedPassTypeId?: string
}

export function PassPurchaseForm({
  organizationId,
  organizationName,
  organizationLogo,
  siteId,
  siteName,
  deviceId,
  deviceName,
  deviceDescription,
  preSelectedPassTypeId,
}: PassPurchaseFormProps) {
  const [passTypes, setPassTypes] = useState<PassType[]>([])
  const [selectedPassTypeId, setSelectedPassTypeId] = useState(preSelectedPassTypeId || "")
  const [numberOfDays, setNumberOfDays] = useState(0)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"selection" | "details" | "payment">("selection")
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    const abortController = new AbortController()
    async function loadPassTypes() {
      try {
        const url = `/api/pass-types${organizationId ? `?orgId=${organizationId}` : ""}`
        const res = await fetch(url, { signal: abortController.signal })
        if (res.ok) {
          const data: PassType[] = await res.json()
          setPassTypes(data)
          if (!selectedPassTypeId && data.length > 0 && preSelectedPassTypeId) {
            if (data.some((pt) => pt.id === preSelectedPassTypeId)) {
              setSelectedPassTypeId(preSelectedPassTypeId)
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
      }
    }
    loadPassTypes()
    return () => abortController.abort()
  }, [organizationId, preSelectedPassTypeId, selectedPassTypeId])

  useEffect(() => {
    clearPaymentAttempt()
  }, [])

  const selectedPassType = passTypes.find((pt) => pt.id === selectedPassTypeId)
  const isMultiDayPass = selectedPassType?.name?.toLowerCase().includes("camping")
  const totalPriceCents = selectedPassType ? selectedPassType.price_cents * (isMultiDayPass ? numberOfDays : 1) : 0
  const currency = selectedPassType?.currency?.toUpperCase() || "AUD"
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

  useEffect(() => {
    if (!isMultiDayPass) {
      setNumberOfDays(1)
    } else {
      setNumberOfDays(0)
    }
  }, [selectedPassTypeId, isMultiDayPass])

  const handleContinueToDetails = () => {
    if (!selectedPassTypeId) return
    if (isMultiDayPass && numberOfDays === 0) return
    setStep("details")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email?.trim()) {
      alert("Please enter your email address")
      return
    }
    if (!termsAccepted) {
      alert("Please accept the terms and conditions")
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const key = getOrCreatePaymentAttemptKey()
      const payload = {
        accessPointId: deviceId,
        passTypeId: selectedPassTypeId,
        plate: "",
        email: email,
        phone: phone || "",
        numberOfDays: isMultiDayPass ? numberOfDays : 1,
      }
      const data = await createPaymentIntent(payload, key)
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setStep("payment")
      } else {
        throw new Error("No client secret received")
      }
      setIsLoading(false)
    } catch (error) {
      console.error("Payment intent error:", error)
      setError(error instanceof Error ? error.message : "Something went wrong. Please try again.")
      setIsLoading(false)
    }
  }

  // Payment Step - Compact Banner
  if (clientSecret && step === "payment") {
    return (
      <div className="min-h-screen bg-premium-gradient">
        {/* Compact Navy Banner */}
        <div className="bg-navy-banner px-4 py-3">
          <div className="max-w-md mx-auto flex items-center gap-2">
            {organizationLogo && !logoError ? (
              <img src={organizationLogo} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" onError={() => setLogoError(true)} />
            ) : (
              <Anchor className="w-5 h-5 text-white/80" />
            )}
            <span className="font-semibold text-white text-sm">{organizationName || "Access Pass"}</span>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="premium-card rounded-xl p-4 max-w-md mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#001F3F] flex items-center justify-center">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <h2 className="text-base font-bold text-[#001F3F]">Complete Payment</h2>
            </div>

            {selectedPassType && (
              <div className="bg-[#f8fafc] rounded-xl p-3 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-[#001F3F] text-sm">{selectedPassType.name}</p>
                    {isMultiDayPass && <p className="text-xs text-[#64748b]">{numberOfDays} {numberOfDays === 1 ? "day" : "days"}</p>}
                  </div>
                  <p className="text-xl font-bold text-[#001F3F]">{formatPrice(totalPriceCents)}</p>
                </div>
              </div>
            )}

            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm returnUrl={`${window.location.origin}/success`} customerEmail={email} />
            </Elements>
          </div>
        </div>
      </div>
    )
  }

  // Details Step - Compact Banner
  if (step === "details") {
    return (
      <div className="min-h-screen bg-premium-gradient">
        {/* Compact Navy Banner */}
        <div className="bg-navy-banner px-4 py-3">
          <div className="max-w-md mx-auto flex items-center gap-2">
            {organizationLogo && !logoError ? (
              <img src={organizationLogo} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" onError={() => setLogoError(true)} />
            ) : (
              <Anchor className="w-5 h-5 text-white/80" />
            )}
            <span className="font-semibold text-white text-sm">{organizationName || "Access Pass"}</span>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="premium-card rounded-xl p-4 max-w-md mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#001F3F] flex items-center justify-center">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <h2 className="text-base font-bold text-[#001F3F]">Your Details</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-[#64748b]">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 rounded-xl border-[#e2e8f0] text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium text-[#64748b]">Mobile (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+61 412 345 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10 rounded-xl border-[#e2e8f0] text-sm"
                  />
                </div>
              </div>

              {selectedPassType && (
                <div className="bg-[#f8fafc] rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-[#001F3F] text-sm">{selectedPassType.name}</p>
                      {isMultiDayPass && <p className="text-xs text-[#64748b]">{numberOfDays} {numberOfDays === 1 ? "day" : "days"}</p>}
                    </div>
                    <p className="text-xl font-bold text-[#001F3F]">{formatPrice(totalPriceCents)}</p>
                  </div>
                </div>
              )}

              <label htmlFor="terms" className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                termsAccepted ? "bg-[#f0fdf4] border border-[#22c55e]" : "bg-[#f8fafc] border border-transparent"
              }`}>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                  termsAccepted ? "bg-[#22c55e]" : "border border-[#e2e8f0] bg-white"
                }`}>
                  {termsAccepted && <Check className="w-3 h-3 text-white" />}
                </div>
                <input type="checkbox" id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="sr-only" />
                <span className="text-xs text-[#001F3F]">
                  I accept the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#001F3F] font-semibold underline" onClick={(e) => e.stopPropagation()}>terms and conditions</a>
                </span>
              </label>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("selection")}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold border-[#001F3F] text-[#001F3F] bg-transparent btn-premium"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !termsAccepted}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold bg-[#001F3F] text-white btn-premium"
                >
                  {isLoading ? "Processing..." : "Continue"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Selection Step - Hero Header
  return (
    <div className="min-h-screen bg-premium-gradient">
      {/* Medium Hero Header */}
      <div className="bg-nautical-gradient px-4 py-6">
        <div className="max-w-md mx-auto text-center">
          {organizationLogo && !logoError ? (
            <img 
              src={organizationLogo} 
              alt={organizationName || "Organization logo"} 
              className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border-2 border-white/20"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur mb-3">
              <Anchor className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white tracking-tight">{organizationName || "Access Pass"}</h1>
        </div>
      </div>

      <div className="px-4 py-4 -mt-4">
        <div className="premium-card rounded-xl p-4 max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#001F3F] flex items-center justify-center">
              <span className="text-white text-xs font-bold">1</span>
            </div>
            <h2 className="text-base font-bold text-[#001F3F]">Select Your Pass</h2>
          </div>

          {/* Horizontal Pass Type Selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {passTypes.map((pt) => {
              const isCamping = pt.name?.toLowerCase().includes("camping")
              const isSelected = selectedPassTypeId === pt.id
              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setSelectedPassTypeId(pt.id)}
                  className={`p-3 rounded-xl text-left transition-all selection-card ${isSelected ? "selected bg-white" : "bg-[#f8fafc]"}`}
                >
                  <h3 className="font-semibold text-[#001F3F] text-sm">{pt.name}</h3>
                  <p className="text-lg font-bold text-[#001F3F] mt-1">{formatPrice(pt.price_cents)}{isCamping && <span className="text-xs font-normal text-[#64748b]">/day</span>}</p>
                  {isSelected && (
                    <div className="mt-1 flex items-center gap-1 text-[#d4af37]">
                      <Check className="w-3 h-3" />
                      <span className="text-xs font-medium">Selected</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Number of Days - inline */}
          {isMultiDayPass && (
            <div className="mb-4">
              <Label htmlFor="numberOfDays" className="text-xs font-medium text-[#64748b] mb-1.5 block">Number of Days *</Label>
              <Select value={numberOfDays === 0 ? "" : numberOfDays.toString()} onValueChange={(val) => setNumberOfDays(Number.parseInt(val, 10))}>
                <SelectTrigger id="numberOfDays" className={`h-10 rounded-xl text-sm ${numberOfDays === 0 ? "border-[#d4af37] border-2" : ""}`}>
                  <SelectValue placeholder="Select days" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {[1, 2, 3, 4, 5, 6, 7, 14, 21, 28].map((days) => (
                    <SelectItem key={days} value={days.toString()} className="py-2 rounded-lg text-sm">
                      {days} {days === 1 ? "day" : "days"} - {formatPrice((selectedPassType?.price_cents ?? 0) * days)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Total Summary */}
          {selectedPassType && (isMultiDayPass ? numberOfDays > 0 : true) && (
            <div className="bg-[#001F3F] rounded-xl p-3 mb-4">
              <div className="flex justify-between items-center text-white">
                <span className="text-sm font-medium">Total</span>
                <span className="text-2xl font-bold">{formatPrice(totalPriceCents)}</span>
              </div>
              <p className="text-white/50 text-xs text-right">incl. GST</p>
            </div>
          )}

          <Button
            type="button"
            onClick={handleContinueToDetails}
            disabled={!selectedPassTypeId || (isMultiDayPass && numberOfDays === 0)}
            className="w-full h-11 rounded-xl text-sm font-semibold bg-[#001F3F] text-white btn-premium disabled:opacity-50"
          >
            BUY PASS
          </Button>

          {/* Receipt & Tax Invoice Info */}
          <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
            <p className="text-xs font-semibold text-[#001F3F] mb-1">Receipt & tax invoice</p>
            <p className="text-xs text-[#64748b] leading-relaxed">
              A payment receipt will be emailed to you after purchase.
              Need a GST tax invoice? You can request one after checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
