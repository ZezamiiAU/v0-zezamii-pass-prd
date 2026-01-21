"use client"

import React from "react"
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
import { Check } from "lucide-react"
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
  const [fullName, setFullName] = useState("")
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

  // Validate full name - must contain only letters, spaces, hyphens, apostrophes
  const validateFullName = (name: string): string | null => {
    if (!name || !name.trim()) {
      return "Please enter your full name"
    }
    if (name.trim().length < 2) {
      return "Name must be at least 2 characters"
    }
    if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) {
      return "Name can only contain letters, spaces, hyphens, and apostrophes"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const nameError = validateFullName(fullName)
    if (nameError) {
      alert(nameError)
      return
    }
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
        fullName: fullName.trim(),
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

  // Payment Step - Slim Utility Bar (44px)
  if (clientSecret && step === "payment") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#1e293b]">
        {/* Slim Top Utility Bar - 44px for Operational Pages */}
        <div className="fixed top-0 left-0 right-0 h-11 bg-[#020617] flex items-center justify-between px-4 z-50 border-b border-white/10">
          <div className="flex items-center gap-2">
            <img src="/zezamii-logo.png" alt="Zezamii" className="w-5 h-5 rounded" />
            <span className="text-white font-semibold text-xs uppercase tracking-widest">Zezamii Pass</span>
          </div>
          <div className="flex items-center gap-2">
            <img 
              src={organizationLogo && !logoError ? organizationLogo : "/images/griffith-boat-club-logo.png"} 
              alt="" 
              className="w-6 h-6 rounded-full object-cover border border-white/20 bg-white" 
              onError={() => setLogoError(true)} 
            />
            <span className="font-medium text-white text-xs">{organizationName}</span>
          </div>
        </div>

        <div className="pt-[52px] px-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 max-w-md mx-auto">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-full bg-[#020617] flex items-center justify-center">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <h2 className="text-lg font-bold text-[#020617] tracking-tight">Complete Payment</h2>
            </div>

            {selectedPassType && (
              <div className="bg-[#f8fafc] rounded-xl p-3 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-[#001F3F] text-sm">{selectedPassType.name}</p>
                    {isMultiDayPass && <p className="text-xs text-[#64748b]">{numberOfDays} {numberOfDays === 1 ? "day" : "days"}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#001F3F]">{formatPrice(totalPriceCents)}</p>
                    <p className="text-xs text-[#64748b]">including GST</p>
                  </div>
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

  // Details Step - Slim Utility Bar (44px)
  if (step === "details") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#1e293b]">
        {/* Slim Top Utility Bar - 44px for Operational Pages */}
        <div className="fixed top-0 left-0 right-0 h-11 bg-[#020617] flex items-center justify-between px-4 z-50 border-b border-white/10">
          <div className="flex items-center gap-2">
            <img src="/zezamii-logo.png" alt="Zezamii" className="w-5 h-5 rounded" />
            <span className="text-white font-semibold text-xs uppercase tracking-widest">Zezamii Pass</span>
          </div>
          <div className="flex items-center gap-2">
            <img 
              src={organizationLogo && !logoError ? organizationLogo : "/images/griffith-boat-club-logo.png"} 
              alt="" 
              className="w-6 h-6 rounded-full object-cover border border-white/20 bg-white" 
              onError={() => setLogoError(true)} 
            />
            <span className="font-medium text-white text-xs">{organizationName}</span>
          </div>
        </div>

        <div className="pt-[52px] px-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 max-w-md mx-auto">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-full bg-[#020617] flex items-center justify-center">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <h2 className="text-lg font-bold text-[#020617] tracking-tight">Your Details</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-medium text-slate-600">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 text-sm focus:border-[#020617] focus:ring-[#020617]"
                    required
                  />
                  <p className="text-[10px] text-slate-400">Required for credit card payment</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-slate-600">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 text-sm focus:border-[#020617] focus:ring-[#020617]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium text-slate-600">
                    Mobile <span className="text-slate-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+61 412 345 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 text-sm focus:border-[#020617] focus:ring-[#020617]"
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

  // Selection Step - Slim Utility Bar (44px) with Org Header
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#1e293b]">
      {/* Slim Top Utility Bar - 44px for Operational Pages */}
      <div className="fixed top-0 left-0 right-0 h-11 bg-[#020617] flex items-center justify-between px-4 z-50 border-b border-white/10">
        <div className="flex items-center gap-2">
          <img src="/zezamii-logo.png" alt="Zezamii" className="w-5 h-5 rounded" />
          <span className="text-white font-semibold text-xs uppercase tracking-widest">Zezamii Pass</span>
        </div>
        <div className="flex items-center gap-2">
          <img 
            src={organizationLogo && !logoError ? organizationLogo : "/images/griffith-boat-club-logo.png"} 
            alt="" 
            className="w-6 h-6 rounded-full object-cover border border-white/20 bg-white"
            onError={() => setLogoError(true)}
          />
          <span className="font-medium text-white text-xs">{organizationName}</span>
        </div>
      </div>

      {/* Compact Org Header - Inside card for high density */}
      <div className="pt-[52px] px-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 max-w-md mx-auto">
          {/* Org Branding - Inline */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
            <img 
              src={organizationLogo && !logoError ? organizationLogo : "/images/griffith-boat-club-logo.png"} 
              alt={organizationName || "Organization logo"} 
              className="w-12 h-12 rounded-full object-cover border border-slate-200 bg-white"
              onError={() => setLogoError(true)}
            />
            <h1 className="text-xl font-bold text-[#020617] tracking-tight">{organizationName || "Zezamii Pass"}</h1>
          </div>

          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#020617] flex items-center justify-center">
              <span className="text-white text-xs font-bold">1</span>
            </div>
            <h2 className="text-lg font-bold text-[#020617] tracking-tight">Select Your Pass</h2>
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
              <Label htmlFor="numberOfDays" className="text-xs font-medium text-slate-600 mb-1.5 block">
                    Number of Days <span className="text-red-500">*</span>
                  </Label>
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
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-[#020617] mb-1">Receipt & tax invoice</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              A payment receipt will be emailed to you after purchase.
              Need a GST tax invoice? You can request one after checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
