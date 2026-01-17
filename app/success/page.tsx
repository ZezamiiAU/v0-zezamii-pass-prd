"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { sessionQuerySchema } from "@/lib/schemas/api.schema"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatLocalizedDateTime } from "@/lib/timezone"
import { WifiOff, MessageSquare, AlertTriangle, Copy, ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface PassDetails {
  pass_id: string
  accessPointName: string
  timezone: string
  code: string | null
  codeUnavailable?: boolean
  valid_from: string
  valid_to: string
  passType: string
  vehiclePlate: string
  device_id: string
  returnUrl?: string | null
}

function extractErrorMessage(errorData: any): string {
  if (typeof errorData === "string") return errorData
  if (typeof errorData === "object" && errorData !== null) {
    if (typeof errorData.error === "string") return errorData.error
    if (typeof errorData.message === "string") return errorData.message
    if (Array.isArray(errorData.error)) return errorData.error.map((e: any) => e.message || String(e)).join(", ")
    return JSON.stringify(errorData)
  }
  return String(errorData)
}

export default function SuccessPage() {
  const searchParams = useSearchParams()

  const [passDetails, setPassDetails] = useState<PassDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [codeWarning, setCodeWarning] = useState(false)
  const [supportEmail, setSupportEmail] = useState("support@zezamii.com")
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)
  const [isTechnicalDetailsOpen, setIsTechnicalDetailsOpen] = useState(false)

  const rawParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams])

  const paramsValidation = useMemo(
    () =>
      sessionQuerySchema.safeParse({
        session_id: searchParams.get("session_id") || undefined,
        payment_intent: searchParams.get("payment_intent") || undefined,
      }),
    [searchParams],
  )

  const sessionId = paramsValidation.success ? paramsValidation.data.session_id : undefined
  const paymentIntent = paramsValidation.success ? paramsValidation.data.payment_intent : undefined
  const isValid = paramsValidation.success

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
    if (!isValid) {
      const errorInfo = {
        timestamp: new Date().toISOString(),
        url: typeof window !== "undefined" ? window.location.href : "",
        params: rawParams,
        validationError: paramsValidation.error?.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }
      const detailsText = `Error Details:\n${JSON.stringify(errorInfo, null, 2)}`
      setErrorDetails(detailsText)
      setError(`Invalid payment details. Please contact ${supportEmail} with your order confirmation.`)
      setIsLoading(false)
      return
    }

    if (!sessionId && !paymentIntent) {
      const errorInfo = {
        timestamp: new Date().toISOString(),
        url: typeof window !== "undefined" ? window.location.href : "",
        params: rawParams,
        issue: "No session_id or payment_intent parameter found",
      }
      const detailsText = `Error Details:\n${JSON.stringify(errorInfo, null, 2)}`
      setErrorDetails(detailsText)
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
    const MAX_RETRIES = 3
    let pollInterval: NodeJS.Timeout | null = null
    let isMounted = true

    const fetchPassDetails = async () => {
      if (!isMounted) return

      try {
        const queryParam = sessionId ? `session_id=${sessionId}` : `payment_intent=${paymentIntent}`

        // Polling attempt ${retryCount + 1}/${MAX_RETRIES}

        const response = await fetch(`/api/passes/by-session?${queryParam}`, {
          signal: abortController.signal,
        })

        if (!isMounted) return

        if (!response.ok) {
          const errorData = await response.json()

          const errorInfo = {
            timestamp: new Date().toISOString(),
            url: typeof window !== "undefined" ? window.location.href : "",
            params: rawParams,
            apiResponse: {
              status: response.status,
              statusText: response.statusText,
              error: errorData,
            },
          }
          const detailsText = `Error Details:\n${JSON.stringify(errorInfo, null, 2)}`
          setErrorDetails(detailsText)

          if (response.status === 429) {
            setError("Too many requests. Please try again later.")
            setIsLoading(false)
            return
          }

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

              if (syncResponse.ok && isMounted) {
                retryCount++
                const delay = 2000 * Math.pow(1.5, retryCount)
                // Retrying payment sync
                pollInterval = setTimeout(() => fetchPassDetails(), delay)
                return
              }
            } catch (syncError) {
              console.error("Error syncing payment:", syncError instanceof Error ? syncError.message : String(syncError))
            }

            setError(`Lock not connected. Contact ${supportEmail}`)
          } else {
            setError(extractErrorMessage(errorData) || "Unable to load pass details")
          }
          setIsLoading(false)
          return
        }

        const data = await response.json()

        if (!isMounted) return

        if (data.code === null || data.codeUnavailable) {
          setCodeWarning(true)
        }

        setPassDetails(data)
        setIsLoading(false)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        if (!isMounted) return

        console.error("Error fetching pass details:", err instanceof Error ? err.message : String(err))

        const errorInfo = {
          timestamp: new Date().toISOString(),
          url: typeof window !== "undefined" ? window.location.href : "",
          params: rawParams,
          error: err instanceof Error ? err.message : String(err),
          offline: typeof navigator !== "undefined" ? !navigator.onLine : false,
        }
        const detailsText = `Error Details:\n${JSON.stringify(errorInfo, null, 2)}`
        setErrorDetails(detailsText)

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setError("You're offline. PIN display requires an internet connection.")
        } else {
          setError(err instanceof Error ? err.message : "Unable to load pass details. Please try again.")
        }
        setIsLoading(false)
      }
    }

    fetchPassDetails()

    return () => {
      isMounted = false
      abortController.abort()
      if (pollInterval) {
        clearTimeout(pollInterval)
      }
    }
  }, [isValid, sessionId, paymentIntent, isOffline, supportEmail, rawParams, paramsValidation.error])

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

  const copyErrorDetails = () => {
    if (errorDetails) {
      navigator.clipboard.writeText(errorDetails)
      setCopiedToClipboard(true)
      setTimeout(() => setCopiedToClipboard(false), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-2 bg-[#1a2744]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-1 pt-2">
          {isValid ? (
            <>
              <CardTitle className="text-xl">Payment Successful!</CardTitle>
              <CardDescription className="text-sm">Your pass is being created</CardDescription>
            </>
          ) : (
            <CardTitle className="text-xl">Invalid Payment Details</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-2 pb-2">
          {isLoading && (
            <div className="text-center py-4">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading your pass...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className={isOffline ? "border-orange-500 bg-orange-50" : ""}>
              {isOffline ? <WifiOff className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertDescription className={isOffline ? "text-orange-800 text-xs" : "text-xs"}>
                {error}
                {isOffline && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 w-full bg-transparent text-xs h-7"
                    onClick={() => window.location.reload()}
                  >
                    Retry when online
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {passDetails && (
            <div className="space-y-2">
              {codeWarning && (
                <Alert className="border-orange-500 bg-orange-50 py-1">
                  <AlertTriangle className="h-3 w-3 text-orange-600" />
                  <AlertDescription className="text-orange-800 text-xs">
                    Your pass is active but we couldn&apos;t retrieve your PIN. Please contact {supportEmail}.
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-primary/10 p-3 rounded-lg text-center border-2 border-primary/20">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Your Access PIN</p>
                <p className="text-4xl font-bold tracking-widest text-primary">{passDetails.code || "----"}</p>
                {!passDetails.code && <p className="text-xs text-muted-foreground mt-1">Contact support for PIN</p>}
              </div>

              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between py-0.5 border-b">
                  <span className="text-muted-foreground">Access Point:</span>
                  <span className="font-semibold">{passDetails.accessPointName}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b">
                  <span className="text-muted-foreground">Pass Type:</span>
                  <span className="font-medium">{passDetails.passType}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b">
                  <span className="text-muted-foreground">Valid From:</span>
                  <span className="font-medium">{formatDateTime(passDetails.valid_from, passDetails.timezone)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b">
                  <span className="text-muted-foreground">Valid Until:</span>
                  <span className="font-medium">{formatDateTime(passDetails.valid_to, passDetails.timezone)}</span>
                </div>
                {passDetails.vehiclePlate && (
                  <div className="flex justify-between py-0.5 border-b">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className="font-medium">{passDetails.vehiclePlate}</span>
                  </div>
                )}
              </div>

              <Alert className="py-1.5">
                <AlertDescription className="text-xs leading-tight">
                  <strong>Instructions:</strong>{" "}
                  {passDetails.code
                    ? `Enter this PIN at the keypad at ${passDetails.accessPointName} to gain access. Your pass is valid until ${formatDateTime(passDetails.valid_to, passDetails.timezone)}.`
                    : `Your pass is active. Please contact ${supportEmail} to receive your PIN.`}
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                {passDetails.code && (
                  <Button variant="outline" onClick={handleShareSMS} className="w-full bg-transparent text-xs h-8">
                    <MessageSquare className="mr-1 h-3 w-3" />
                    Share via SMS
                  </Button>
                )}

                <Button
                  className="w-full h-8 text-sm bg-[#1a2744] text-white hover:opacity-90"
                  onClick={() => {
                    const url = passDetails?.returnUrl || "/"
                    window.location.replace(`${url}?t=${Date.now()}`)
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {errorDetails && (
            <Collapsible open={isTechnicalDetailsOpen} onOpenChange={setIsTechnicalDetailsOpen}>
              <div className="bg-muted rounded-md border">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-2 hover:bg-muted/50 transition-colors">
                    <p className="font-semibold text-muted-foreground text-xs">Technical Details</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyErrorDetails()
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {copiedToClipboard ? "Copied!" : "Copy"}
                      </Button>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${isTechnicalDetailsOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-2 pb-2 space-y-1">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs bg-background p-1.5 rounded border max-h-24 overflow-y-auto">
                      {errorDetails}
                    </pre>
                    <p className="text-muted-foreground text-xs">
                      Copy these details and send to <strong>{supportEmail}</strong>
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
