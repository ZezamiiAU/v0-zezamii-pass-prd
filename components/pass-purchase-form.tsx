"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PaymentForm } from "@/components/payment-form"
import { createPaymentIntent } from "@/lib/api/payments"
import { getOrCreatePaymentAttemptKey, clearPaymentAttempt } from "@/lib/http/idempotency"

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
  organizationId: string // renamed from orgId
  organizationName?: string // added for branding
  organizationLogo?: string | null // added for branding
  siteId: string
  siteName?: string
  deviceId: string
  deviceName?: string // renamed from accesspointName
  deviceDescription?: string | null // added for branding
  preSelectedPassTypeId?: string // Added preSelectedPassTypeId prop to allow pre-selecting a pass type from the landing page
}

export function PassPurchaseForm({
  organizationId, // renamed from orgId
  organizationName, // added
  organizationLogo, // added
  siteId,
  siteName,
  deviceId,
  deviceName, // renamed from accesspointName
  deviceDescription, // added
  preSelectedPassTypeId, // Destructure new prop
}: PassPurchaseFormProps) {
  const [passTypes, setPassTypes] = useState<PassType[]>([])
  const [selectedPassTypeId, setSelectedPassTypeId] = useState(preSelectedPassTypeId || "")
  const [numberOfDays, setNumberOfDays] = useState(0) // Initialize numberOfDays to 0 (unselected) instead of 1
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contactMethod, setContactMethod] = useState("email") // Declare contactMethod and setContactMethod

  useEffect(() => {
    const abortController = new AbortController()

    async function loadPassTypes() {
      try {
        const url = `/api/pass-types${organizationId ? `?orgId=${organizationId}` : ""}`
        const res = await fetch(url, {
          signal: abortController.signal,
        })

        if (res.ok) {
          const data = await res.json()
          setPassTypes(data)
          if (!selectedPassTypeId && data.length > 0) {
            if (preSelectedPassTypeId && data.some((pt: PassType) => pt.id === preSelectedPassTypeId)) {
              setSelectedPassTypeId(preSelectedPassTypeId)
            } else {
              setSelectedPassTypeId(data[0].id)
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
      }
    }

    loadPassTypes()

    return () => {
      abortController.abort()
    }
  }, [organizationId, preSelectedPassTypeId, selectedPassTypeId]) // Added preSelectedPassTypeId to dependencies

  useEffect(() => {
    clearPaymentAttempt()
  }, [])

  const selectedPassType = passTypes.find((pt) => pt.id === selectedPassTypeId)

  const isMultiDayPass = selectedPassType?.name?.toLowerCase().includes("camping")

  const totalPriceCents = selectedPassType ? selectedPassType.price_cents * (isMultiDayPass ? numberOfDays : 1) : 0

  const currency = selectedPassType?.currency?.toUpperCase() || "AUD"
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)} ${currency}`
  }

  useEffect(() => {
    if (!isMultiDayPass) {
      setNumberOfDays(1)
    } else {
      setNumberOfDays(0) // Reset to unselected for multi-day passes
    }
  }, [selectedPassTypeId, isMultiDayPass])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Email is always required
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

  if (clientSecret) {
    return (
      <Card className="w-full max-h-[90vh] flex flex-col">
        <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
          <CardTitle className="text-xl">Complete Payment</CardTitle>
          {(siteName || deviceName) && (
            <CardDescription className="text-base">{[deviceName, siteName].filter(Boolean).join(" - ")}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3 pb-3 px-4 overflow-y-auto flex-1">
          {selectedPassType && (
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="flex justify-between items-center">
                <span className="text-base text-muted-foreground">
                  {selectedPassType.name}
                  {isMultiDayPass && ` (${numberOfDays} ${numberOfDays === 1 ? "day" : "days"})`}
                </span>
                <span className="text-lg font-bold">
                  {formatPrice(totalPriceCents)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground text-right">incl GST and fees</div>
            </div>
          )}

          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm
              returnUrl={`${window.location.origin}/success`}
              customerEmail={email}
            />
          </Elements>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-h-[90vh] flex flex-col">
      <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
        <CardTitle className="text-xl">Purchase Pass</CardTitle>
        {(siteName || deviceName) && (
          <CardDescription className="text-base">{[deviceName, siteName].filter(Boolean).join(" - ")}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="py-2 px-4 overflow-y-auto flex-1">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="passType" className="text-base font-medium">
              Pass Type
            </Label>
            <Select value={selectedPassTypeId} onValueChange={setSelectedPassTypeId}>
              <SelectTrigger id="passType" className="h-11 text-base">
                <SelectValue placeholder="Select pass type" />
              </SelectTrigger>
              <SelectContent>
                {passTypes.map((pt) => (
                  <SelectItem key={pt.id} value={pt.id} className="text-base py-3">
                    {pt.name} - {formatPrice(pt.price_cents)}
                    {pt.name?.toLowerCase().includes("camping") && " /day"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isMultiDayPass && (
            <div className="space-y-1">
              <Label htmlFor="numberOfDays" className="text-base font-medium">
                Number of Days <span className="text-red-500 font-bold">*</span>
                <span className="text-red-500 text-sm ml-1">(required)</span>
              </Label>
              <Select
                value={numberOfDays === 0 ? "" : numberOfDays.toString()}
                onValueChange={(val) => setNumberOfDays(Number.parseInt(val, 10))}
              >
                <SelectTrigger id="numberOfDays" className={`h-11 text-base ${numberOfDays === 0 ? "border-red-300 border-2" : ""}`}>
                  <SelectValue placeholder="Select number of days" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 14, 21, 28].map((days) => (
                    <SelectItem key={days} value={days.toString()} className="text-base py-3">
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

          <div className="space-y-1">
            <Label htmlFor="email" className="text-base font-medium">
              Email <span className="text-red-500 font-bold">*</span>
              <span className="text-red-500 text-sm ml-1">(required)</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 text-base border-red-300 border-2 focus:border-red-400 focus:ring-red-400"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone" className="text-base">
              Mobile <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+61 412 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 text-base"
            />
          </div>

          {selectedPassType && (
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="flex justify-between items-center">
                <span className="text-base text-muted-foreground">
                  {selectedPassType.name}
                  {isMultiDayPass && numberOfDays > 0 && ` (${numberOfDays} ${numberOfDays === 1 ? "day" : "days"})`}
                </span>
                <span className="text-lg font-bold">
                  {formatPrice(totalPriceCents)}
                </span>
              </div>
              {isMultiDayPass && numberOfDays > 1 && (
                <div className="text-sm text-muted-foreground text-right">
                  {formatPrice(selectedPassType.price_cents)} × {numberOfDays} days
                </div>
              )}
              <div className="text-sm text-muted-foreground text-right">incl GST and fees</div>
            </div>
          )}

          <label
            htmlFor="terms"
            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all min-h-[48px] ${
              termsAccepted 
                ? "border-green-500 bg-green-50" 
                : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }`}
          >
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm leading-snug">
              I accept the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#002147] font-semibold underline hover:no-underline"
                onClick={(e) => e.stopPropagation()}
              >
                terms and conditions
              </a>
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-base text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-12 text-base font-semibold bg-[#002147] text-white hover:bg-[#003366]"
            disabled={isLoading || !selectedPassType || (isMultiDayPass && numberOfDays === 0)}
          >
            {isLoading ? "Processing..." : "Continue to Payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
