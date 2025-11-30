"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatLocalizedDateTime } from "@/lib/timezone"
import { WifiOff, MessageSquare, AlertTriangle } from "lucide-react"
import Image from "next/image"

const SuccessParamsSchema = z.object({
  session_id: z.string().min(1).optional(),
  payment_intent: z.string().startsWith("pi_").optional(),
})

interface PassDetails {
  accessPointName: string
  timezone: string
  code: string | null
  codeUnavailable?: boolean // Added flag to track code fetch issues
  valid_from: string
  valid_to: string
  passType: string
  vehiclePlate: string
  device_id: string
}

export default function SuccessPage() {
  const searchParams = useSearchParams()

  const [passDetails, setPassDetails] = useState<PassDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [codeWarning, setCodeWarning] = useState(false) // Track code fetch issues separately
  const [supportEmail, setSupportEmail] = useState("support@zezamii.com")
  const paramsValidation = SuccessParamsSchema.safeParse(searchParams)

  useEffect(() => {
    const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@zezamii.com"
    setSupportEmail(email)
  }, [])

  useEffect(() => {
    const checkOnlineStatus = () => {
      setIsOffline(!navigator.onLine)
    }

    checkOnlineStatus()
    window.addEventListener("online", checkOnlineStatus)
    window.addEventListener("offline", checkOnlineStatus)

    return () => {
      window.removeEventListener("online", checkOnlineStatus)
      window.removeEventListener("offline", checkOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (!paramsValidation.success) {
      setError(`Invalid payment details. Please contact ${supportEmail} with your order confirmation.`)
      setIsLoading(false)
      return
    }

    const { session_id: sessionId, payment_intent: paymentIntent } = paramsValidation.data

    if (!sessionId && !paymentIntent) {
      setError("No payment information found. Please check your payment confirmation email.")
      setIsLoading(false)
      return
    }

    if (isOffline) {
      setError("You're offline. PIN display requires an internet connection.")
      setIsLoading(false)
      return
    }

    const abortController = new AbortController()
    let retryCount = 0
    const MAX_RETRIES = 5
    let pollInterval: NodeJS.Timeout | null = null

    const fetchPassDetails = async () => {
      try {
        const queryParam = sessionId ? `session_id=${sessionId}` : `payment_intent=${paymentIntent}`

        const response = await fetch(`/api/passes/by-session?${queryParam}`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()

          if ((errorData.status === "pending" || errorData.paymentStatus === "pending") && paymentIntent) {
            if (retryCount >= MAX_RETRIES) {
              setError(`Payment is taking longer than expected. Please contact ${supportEmail}`)
              setIsLoading(false)
              return
            }

            try {
              const syncResponse = await fetch("/api/passes/sync-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentIntentId: paymentIntent }),
                signal: abortController.signal,
              })

              if (syncResponse.ok) {
                retryCount++
                pollInterval = setTimeout(() => fetchPassDetails(), 2000)
                return
              }
            } catch (syncError) {
              console.error("[v0] Error syncing payment:", syncError)
            }

            setError(`Lock not connected. Contact ${supportEmail}`)
          } else {
            setError(errorData.error || "Unable to load pass details")
          }
          setIsLoading(false)
          return
        }

        const data = await response.json()

        if (data.code === null || data.codeUnavailable) {
          setCodeWarning(true)
        }

        setPassDetails(data)
        setIsLoading(false)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        console.error("[v0] Error fetching pass details:", err)
        if (!navigator.onLine) {
          setError("You're offline. PIN display requires an internet connection.")
        } else {
          setError("Unable to load pass details. Please try again.")
        }
        setIsLoading(false)
      }
    }

    fetchPassDetails()

    return () => {
      abortController.abort()
      if (pollInterval) {
        clearTimeout(pollInterval)
      }
    }
  }, [paramsValidation, isOffline, supportEmail])

  const formatDateTime = (dateString: string, timezone: string) => {
    return formatLocalizedDateTime(dateString, timezone)
  }

  const handleShareSMS = () => {
    if (!passDetails) return

    const message = `Your Access Pass:
Access Point: ${passDetails.accessPointName}
PIN: ${passDetails.code || "Contact support"}
Valid until: ${formatDateTime(passDetails.valid_to, passDetails.timezone)}

${passDetails.code ? "Enter this PIN at the keypad to access." : `Please contact ${supportEmail} for your PIN.`}`

    const smsUrl = `sms:?&body=${encodeURIComponent(message)}`
    window.location.href = smsUrl
  }

  const handleAddToGoogleWallet = async () => {
    if (!passDetails) return

    try {
      const userId = (passDetails.device_id || "").toLowerCase().replace(/[^a-z0-9_-]/g, "_")

      const params = new URLSearchParams({
        userId,
        passType: passDetails.passType,
        validFrom: passDetails.valid_from,
        validTo: passDetails.valid_to,
        code: passDetails.code || "",
        vehiclePlate: passDetails.vehiclePlate || "",
        deviceId: passDetails.device_id || "",
      })

      const response = await fetch(`/api/wallet/save?${params.toString()}`)

      const data = await response.json()

      if (!response.ok) {
        alert(
          data.error ||
            "Unable to add to Google Wallet. Please ensure you're accessing from the correct domain and try again.",
        )
        return
      }

      if (data.saveUrl) {
        window.location.href = data.saveUrl
      } else {
        alert("Unable to generate Google Wallet pass")
      }
    } catch (error) {
      alert("Unable to add to Google Wallet at this time")
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-3 bg-brand-gradient">
      <Card className="w-full max-w-md max-h-[80vh] overflow-auto">
        <CardHeader className="text-center pb-2 pt-3">
          {paramsValidation.success ? (
            <>
              <CardTitle className="text-2xl">Payment Successful!</CardTitle>
              <CardDescription className="text-base">Your pass is being created</CardDescription>
            </>
          ) : (
            <CardTitle className="text-2xl">Invalid Payment Details</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-3 pb-3">
          {isLoading && (
            <div className="text-center py-6">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-3 text-sm text-muted-foreground">Loading your pass...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className={isOffline ? "border-orange-500 bg-orange-50" : ""}>
              {isOffline ? <WifiOff className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertDescription className={isOffline ? "text-orange-800 text-sm" : "text-sm"}>
                {error}
                {isOffline && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full bg-transparent text-sm h-8"
                    onClick={() => window.location.reload()}
                  >
                    Retry when online
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {passDetails && (
            <div className="space-y-3">
              {codeWarning && (
                <Alert className="border-orange-500 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 text-sm">
                    Your pass is active but we couldn&apos;t retrieve your PIN. Please contact {supportEmail} with your
                    pass details.
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-primary/10 p-4 rounded-lg text-center border-2 border-primary/20">
                <p className="text-sm text-muted-foreground mb-2 font-medium">Your Access PIN</p>
                <p className="text-5xl font-bold tracking-widest text-primary">{passDetails.code || "----"}</p>
                {!passDetails.code && <p className="text-xs text-muted-foreground mt-2">Contact support for PIN</p>}
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Access Point:</span>
                  <span className="font-semibold">{passDetails.accessPointName}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Pass Type:</span>
                  <span className="font-medium">{passDetails.passType}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Valid From:</span>
                  <span className="font-medium text-xs">
                    {formatDateTime(passDetails.valid_from, passDetails.timezone)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Valid Until:</span>
                  <span className="font-medium text-xs">
                    {formatDateTime(passDetails.valid_to, passDetails.timezone)}
                  </span>
                </div>
                {passDetails.vehiclePlate && (
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className="font-medium">{passDetails.vehiclePlate}</span>
                  </div>
                )}
              </div>

              <Alert className="py-2">
                <AlertDescription className="text-xs">
                  <strong>Instructions:</strong>{" "}
                  {passDetails.code
                    ? `Enter this PIN at the keypad at ${passDetails.accessPointName} to gain access. Your pass is valid until ${formatDateTime(passDetails.valid_to, passDetails.timezone)}.`
                    : `Your pass is active. Please contact ${supportEmail} to receive your PIN.`}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                {passDetails.code && (
                  <>
                    <Button variant="outline" onClick={handleShareSMS} className="w-full bg-transparent text-sm h-9">
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                      Share via SMS
                    </Button>
                    <button
                      onClick={handleAddToGoogleWallet}
                      className="w-full flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      <Image
                        src="/googlewallet.png"
                        alt="Add to Google Wallet"
                        width={180}
                        height={40}
                        className="h-10 w-auto"
                      />
                    </button>
                  </>
                )}
              </div>

              <div className="pt-1">
                <Button
                  className="w-full h-9 text-base bg-brand text-white hover:opacity-90"
                  onClick={() => (window.location.href = "/")}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
