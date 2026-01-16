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
  const [numberOfDays, setNumberOfDays] = useState(1)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [contactMethod, setContactMethod] = useState("email")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          console.log("[v0] PassPurchaseForm loadPassTypes:", {
            preSelectedPassTypeId,
            dataIds: data.map((pt: PassType) => pt.id),
            match: data.some((pt: PassType) => pt.id === preSelectedPassTypeId),
          })
          if (!selectedPassTypeId && data.length > 0) {
            if (preSelectedPassTypeId && data.some((pt: PassType) => pt.id === preSelectedPassTypeId)) {
              console.log("[v0] Setting selectedPassTypeId to preSelectedPassTypeId:", preSelectedPassTypeId)
              setSelectedPassTypeId(preSelectedPassTypeId)
            } else {
              console.log("[v0] Fallback: setting selectedPassTypeId to first item:", data[0].id)
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

  console.log("[v0] Render - selectedPassTypeId:", selectedPassTypeId, "passTypes count:", passTypes.length)

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
    }
  }, [selectedPassTypeId, isMultiDayPass])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (contactMethod === "email" && (!email || !email.trim())) {
      alert("Please enter your email address")
      return
    }

    if (contactMethod === "mobile" && (!phone || !phone.trim())) {
      alert("Please enter your mobile number")
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
        email: contactMethod === "email" ? email : "",
        phone: contactMethod === "mobile" ? phone : "",
        numberOfDays: isMultiDayPass ? numberOfDays : 1,
      }
      console.log("[v0] Sending payment intent request:", payload)

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
      <Card className="w-full">
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-lg">Complete Payment</CardTitle>
          {(siteName || deviceName) && (
            <CardDescription className="text-xs">{[deviceName, siteName].filter(Boolean).join(" - ")}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-2 pb-2 px-3 max-h-[70vh] overflow-y-auto">
          {selectedPassType && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-1 pt-1.5 px-2">
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 pb-1.5 px-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pass Type:</span>
                  <span className="font-medium">{selectedPassType.name}</span>
                </div>
                {isMultiDayPass && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Number of Days:</span>
                    <span className="font-medium">
                      {numberOfDays} {numberOfDays === 1 ? "day" : "days"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">
                    {isMultiDayPass
                      ? `${numberOfDays} ${numberOfDays === 1 ? "day" : "days"}`
                      : selectedPassType.duration_minutes >= 60
                        ? `${Math.floor(selectedPassType.duration_minutes / 60)} hours`
                        : `${selectedPassType.duration_minutes} minutes`}
                  </span>
                </div>
                {selectedPassType.description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Details:</span>
                    <span className="font-medium text-xs">{selectedPassType.description}</span>
                  </div>
                )}
                {isMultiDayPass && numberOfDays > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium">
                      {formatPrice(selectedPassType.price_cents)} × {numberOfDays} days
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-0.5 border-t text-sm">
                  <span className="font-semibold">Total:</span>
                  <span className="font-semibold">
                    {formatPrice(totalPriceCents)}
                    <span className="text-xs text-muted-foreground ml-1">(incl GST and fees)</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm
              returnUrl={`${window.location.origin}/success`}
              customerEmail={contactMethod === "email" ? email : ""}
            />
          </Elements>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-1 pt-2 px-3">
        <CardTitle className="text-lg">Purchase Pass</CardTitle>
        {(siteName || deviceName) && (
          <CardDescription className="text-base">{[deviceName, siteName].filter(Boolean).join(" - ")}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="py-1.5 px-3">
        <form onSubmit={handleSubmit} className="space-y-1.5">
          <div className="space-y-0.5">
            <Label htmlFor="passType" className="text-sm">
              Pass Type
            </Label>
            <Select value={selectedPassTypeId} onValueChange={setSelectedPassTypeId}>
              <SelectTrigger id="passType" className="h-7 text-sm">
                <SelectValue placeholder="Select pass type" />
              </SelectTrigger>
              <SelectContent>
                {passTypes.map((pt) => (
                  <SelectItem key={pt.id} value={pt.id}>
                    {pt.name} - {formatPrice(pt.price_cents)}
                    {pt.name?.toLowerCase().includes("camping") && " /day"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isMultiDayPass && (
            <div className="space-y-0.5">
              <Label htmlFor="numberOfDays" className="text-sm">
                Number of Days
              </Label>
              <Select
                value={numberOfDays.toString()}
                onValueChange={(val) => setNumberOfDays(Number.parseInt(val, 10))}
              >
                <SelectTrigger id="numberOfDays" className="h-7 text-sm">
                  <SelectValue placeholder="Select days" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 14, 21, 28].map((days) => (
                    <SelectItem key={days} value={days.toString()}>
                      {days} {days === 1 ? "day" : "days"} - {formatPrice(selectedPassType!.price_cents * days)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground leading-tight">
                {formatPrice(selectedPassType?.price_cents || 0)} per day
              </p>
            </div>
          )}

          <div className="space-y-0.5">
            <Label className="text-sm">Receive pass via</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={contactMethod === "email" ? "default" : "outline"}
                size="sm"
                className={`flex-1 h-7 text-sm ${contactMethod === "email" ? "bg-[#002147] text-white" : ""}`}
                onClick={() => setContactMethod("email")}
              >
                Email
              </Button>
              <Button
                type="button"
                variant={contactMethod === "mobile" ? "default" : "outline"}
                size="sm"
                className={`flex-1 h-7 text-sm ${contactMethod === "mobile" ? "bg-[#002147] text-white" : ""}`}
                onClick={() => setContactMethod("mobile")}
              >
                Mobile (SMS)
              </Button>
            </div>
          </div>

          {contactMethod === "email" ? (
            <div className="space-y-0.5">
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-7 text-sm"
                required
              />
              <p className="text-xs text-muted-foreground leading-tight">Your pass will be sent to this email</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <Label htmlFor="phone" className="text-sm">
                Mobile Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0412 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-7 text-sm"
                required
              />
              <p className="text-xs text-muted-foreground leading-tight">Your pass will be sent via SMS</p>
            </div>
          )}

          {selectedPassType && (
            <Card className="bg-muted/50 mt-1">
              <CardHeader className="pb-1 pt-1.5 px-2">
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 pb-1.5 px-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pass Type:</span>
                  <span className="font-medium">{selectedPassType.name}</span>
                </div>
                {isMultiDayPass && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Number of Days:</span>
                    <span className="font-medium">
                      {numberOfDays} {numberOfDays === 1 ? "day" : "days"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">
                    {isMultiDayPass
                      ? `${numberOfDays} ${numberOfDays === 1 ? "day" : "days"}`
                      : selectedPassType.duration_minutes >= 60
                        ? `${Math.floor(selectedPassType.duration_minutes / 60)} hours`
                        : `${selectedPassType.duration_minutes} minutes`}
                  </span>
                </div>
                {selectedPassType.description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Details:</span>
                    <span className="font-medium text-xs">{selectedPassType.description}</span>
                  </div>
                )}
                {isMultiDayPass && numberOfDays > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium">
                      {formatPrice(selectedPassType.price_cents)} × {numberOfDays} days
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-0.5 border-t text-sm">
                  <span className="font-semibold">Total:</span>
                  <span className="font-semibold">
                    {formatPrice(totalPriceCents)}
                    <span className="text-xs text-muted-foreground block">incl GST and fees</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-start space-x-1.5 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-3 w-3"
            />
            <Label htmlFor="terms" className="text-xs font-normal leading-tight">
              I accept the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                terms and conditions
              </a>{" "}
              for pass usage
            </Label>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 mt-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            size="sm"
            className="w-full mt-1.5 h-8 text-sm bg-brand text-white hover:opacity-90"
            disabled={isLoading || !selectedPassType}
          >
            {isLoading ? "Processing..." : "Continue to Payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
