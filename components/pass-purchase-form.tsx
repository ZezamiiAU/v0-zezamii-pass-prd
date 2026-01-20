"use client"

import type React from "react"
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

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
if (!publishableKey) {
  throw new Error("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
}
const stripePromise = loadStripe(publishableKey)

interface PassType {
  id: string
  name: string
  code: string
  description: string | null
  price_cents: number
  duration_minutes: number
  currency?: string
}

interface PassPurchaseFormProps {
  organizationId: string
  organizationName?: string
  organizationLogo?: string | null
  siteId: string
  siteName?: string
  deviceId: string
  deviceName?: string
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

  useEffect(() => {
    const abortController = new AbortController()

    async function loadPassTypes() {
      try {
        const url = `/api/pass-types${organizationId ? `?orgId=${organizationId}` : ""}`
        const res = await fetch(url, { signal: abortController.signal })

        if (res.ok) {
          const data = await res.json()
          setPassTypes(data)
          if (!selectedPassTypeId && data.length > 0) {
            if (preSelectedPassTypeId && data.some((pt: PassType) => pt.id === preSelectedPassTypeId)) {
              setSelectedPassTypeId(preSelectedPassTypeId)
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
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

  const handlePassSelection = (passTypeId: string) => {
    setSelectedPassTypeId(passTypeId)
  }

  const handleContinueToDetails = () => {
    if (!selectedPassTypeId) return
    if (isMultiDayPass && numberOfDays === 0) return
    setStep("details")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !email.trim()) {
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
      const errorMessage = error instanceof Error ? error.message : "Something went wrong. Please try again."
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  // Payment Step
  if (clientSecret && step === "payment") {
    return (
      <div className="min-h-screen bg-nautical-gradient">
        <div className="px-4 py-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {organizationName || "Access Pass"}
            </h1>
            {siteName && (
              <p className="text-sky-200 text-sm mt-1">{siteName}</p>
            )}
          </div>

          {/* Glass Card */}
          <div className="glass-card rounded-3xl p-6 max-w-md mx-auto animate-spring-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#001F3F] flex items-center justify-center">
                <span className="text-white text-sm font-bold">3</span>
              </div>
              <h2 className="text-xl font-bold text-[#001F3F] tracking-tight">Complete Payment</h2>
            </div>

            {/* Order Summary */}
            {selectedPassType && (
              <div className="bg-[#f8fafc] rounded-2xl p-4 mb-6 border border-[#e2e8f0]">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-[#001F3F]">{selectedPassType.name}</p>
                    {isMultiDayPass && (
                      <p className="text-sm text-muted-foreground">{numberOfDays} {numberOfDays === 1 ? "day" : "days"}</p>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-[#001F3F]">{formatPrice(totalPriceCents)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-right">incl. GST</p>
              </div>
            )}

            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm
                returnUrl={`${window.location.origin}/success`}
                customerEmail={email}
              />
            </Elements>
          </div>
        </div>
      </div>
    )
  }

  // Details Step
  if (step === "details") {
    return (
      <div className="min-h-screen bg-nautical-gradient">
        <div className="px-4 py-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {organizationName || "Access Pass"}
            </h1>
            {siteName && (
              <p className="text-sky-200 text-sm mt-1">{siteName}</p>
            )}
          </div>

          {/* Glass Card */}
          <div className="glass-card rounded-3xl p-6 max-w-md mx-auto animate-spring-in">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#001F3F] flex items-center justify-center">
                <span className="text-white text-sm font-bold">2</span>
              </div>
              <h2 className="text-xl font-bold text-[#001F3F] tracking-tight">Your Details</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#001F3F]">
                  Email Address <span className="text-[#7dd3fc]">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-2xl border-[#e2e8f0] bg-white focus:border-[#001F3F] focus:ring-[#7dd3fc] text-base"
                  required
                />
              </div>

              {/* Phone Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-[#001F3F]">
                  Mobile <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+61 412 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-2xl border-[#e2e8f0] bg-white focus:border-[#001F3F] focus:ring-[#7dd3fc] text-base"
                />
              </div>

              {/* Order Summary */}
              {selectedPassType && (
                <div className="bg-[#f8fafc] rounded-2xl p-4 border border-[#e2e8f0]">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-[#001F3F]">{selectedPassType.name}</p>
                      {isMultiDayPass && (
                        <p className="text-sm text-muted-foreground">{numberOfDays} {numberOfDays === 1 ? "day" : "days"}</p>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-[#001F3F]">{formatPrice(totalPriceCents)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-right">incl. GST</p>
                </div>
              )}

              {/* Terms Checkbox */}
              <label
                htmlFor="terms"
                className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all ${
                  termsAccepted 
                    ? "bg-[#f0fdf4] border-2 border-[#22c55e]" 
                    : "bg-[#f8fafc] border-2 border-transparent hover:border-[#e2e8f0]"
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                  termsAccepted ? "bg-[#22c55e]" : "border-2 border-[#e2e8f0] bg-white"
                }`}>
                  {termsAccepted && <Check className="w-4 h-4 text-white" />}
                </div>
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-sm text-[#001F3F]">
                  I accept the{" "}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0d4f5c] font-semibold underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    terms and conditions
                  </a>
                </span>
              </label>

              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("selection")}
                  className="flex-1 h-14 rounded-3xl text-base font-semibold border-[#001F3F] text-[#001F3F] hover:bg-[#f8fafc] bg-transparent"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !termsAccepted}
                  className="flex-1 h-14 rounded-3xl text-base font-semibold bg-[#001F3F] text-white hover:bg-[#0a3d62]"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Continue to Payment"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Selection Step (Landing)
  return (
    <div className="min-h-screen bg-nautical-gradient">
      <div className="px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur mb-4">
            <Anchor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {organizationName || "Access Pass"}
          </h1>
          {siteName && (
            <p className="text-sky-200 text-sm mt-2">{siteName}</p>
          )}
        </div>

        {/* Glass Card */}
        <div className="glass-card rounded-3xl p-6 max-w-md mx-auto animate-spring-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#001F3F] flex items-center justify-center">
              <span className="text-white text-sm font-bold">1</span>
            </div>
            <h2 className="text-xl font-bold text-[#001F3F] tracking-tight">Select Your Pass</h2>
          </div>

          {/* Pass Type Cards */}
          <div className="space-y-3 mb-6">
            {passTypes.map((pt) => {
              const isCamping = pt.name?.toLowerCase().includes("camping")
              const isSelected = selectedPassTypeId === pt.id

              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => handlePassSelection(pt.id)}
                  className={`w-full p-4 rounded-2xl text-left transition-all selection-card ${
                    isSelected ? "selected bg-white" : "bg-[#f8fafc] hover:bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-[#001F3F] text-lg">{pt.name}</h3>
                      {pt.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{pt.description}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-[#001F3F]">{formatPrice(pt.price_cents)}</p>
                      {isCamping && <p className="text-xs text-muted-foreground">/day</p>}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1 text-[#0d4f5c]">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Number of Days for Camping */}
          {isMultiDayPass && (
            <div className="mb-6 space-y-2">
              <Label htmlFor="numberOfDays" className="text-sm font-medium text-[#001F3F]">
                Number of Days <span className="text-[#7dd3fc]">*</span>
              </Label>
              <Select
                value={numberOfDays === 0 ? "" : numberOfDays.toString()}
                onValueChange={(val) => setNumberOfDays(Number.parseInt(val, 10))}
              >
                <SelectTrigger 
                  id="numberOfDays" 
                  className={`h-12 rounded-2xl text-base ${
                    numberOfDays === 0 ? "border-[#7dd3fc] border-2" : "border-[#e2e8f0]"
                  }`}
                >
                  <SelectValue placeholder="Select number of days" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {[1, 2, 3, 4, 5, 6, 7, 14, 21, 28].map((days) => (
                    <SelectItem key={days} value={days.toString()} className="py-3 rounded-xl">
                      {days} {days === 1 ? "day" : "days"} - {formatPrice(selectedPassType!.price_cents * days)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {formatPrice(selectedPassType?.price_cents || 0)} per day
              </p>
            </div>
          )}

          {/* Total */}
          {selectedPassType && (isMultiDayPass ? numberOfDays > 0 : true) && (
            <div className="bg-[#001F3F] rounded-2xl p-4 mb-6">
              <div className="flex justify-between items-center text-white">
                <span className="font-medium">Total</span>
                <span className="text-3xl font-bold">{formatPrice(totalPriceCents)}</span>
              </div>
              <p className="text-sky-200 text-xs text-right mt-1">incl. GST</p>
            </div>
          )}

          {/* Continue Button */}
          <Button
            type="button"
            onClick={handleContinueToDetails}
            disabled={!selectedPassTypeId || (isMultiDayPass && numberOfDays === 0)}
            className="w-full h-14 rounded-3xl text-base font-semibold bg-[#001F3F] text-white hover:bg-[#0a3d62] disabled:opacity-50"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
