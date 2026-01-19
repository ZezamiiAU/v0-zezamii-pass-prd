"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { sessionQuerySchema } from "@/lib/schemas/api.schema"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatLocalizedDateTime } from "@/lib/timezone"
import { WifiOff, MessageSquare, AlertTriangle, Copy, ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AnimatedCountdown } from "@/components/animated-countdown"

// Use environment variable or default to 20 seconds (matches ROOMS_API_TIMEOUT_MS=20000)
const COUNTDOWN_SECONDS = Number(process.env.NEXT_PUBLIC_PIN_COUNTDOWN_SECONDS) || 20

interface PassDetails {
  pass_id: string
  accessPointName: string
  timezone: string
  code: string | null
  backupCode?: string | null
  pinSource?: "rooms" | "backup" | null
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
  
  // Countdown timer for waiting for Rooms pincode - starts immediately
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [isWaitingForRooms, setIsWaitingForRooms] = useState(true) // Start waiting immediately
  const [roomsPinReceived, setRoomsPinReceived] = useState(false)
  const [displayedCode, setDisplayedCode] = useState<string | null>(null)
  const [pinSource, setPinSource] = useState<"rooms" | "backup" | null>(null)
  const [backupCodeCached, setBackupCodeCached] = useState<string | null>(null)
  
  // Wallet state - controlled by NEXT_PUBLIC_WALLET_ENABLED env var
  const [walletEnabled] = useState(() => process.env.NEXT_PUBLIC_WALLET_ENABLED === "true")
  const [googleWalletUrl, setGoogleWalletUrl] = useState<string | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  const rawParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams])

  // Fetch Google Wallet URL when pass details are available and wallet is enabled
  const fetchGoogleWalletUrl = useCallback(async (passId: string) => {
    if (!walletEnabled || !passId) return
    
    setWalletLoading(true)
    try {
      const res = await fetch(`/api/wallet/google?pass_id=${passId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setGoogleWalletUrl(data.url)
        }
      }
    } catch (err) {
      // Wallet is optional - don't show errors
    } finally {
      setWalletLoading(false)
    }
  }, [walletEnabled])

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

  // Countdown timer effect
  useEffect(() => {
    if (!isWaitingForRooms || roomsPinReceived || countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isWaitingForRooms, roomsPinReceived, countdown])

  // When countdown ends, show whatever code we have (Rooms or backup)
  // This effect runs whenever backupCodeCached or countdown changes
  useEffect(() => {
    const codeToShow = backupCodeCached || passDetails?.backupCode || passDetails?.code
    // Show code when: countdown is done AND we have a code AND not already displayed
    if (countdown === 0 && codeToShow && !displayedCode) {
      setDisplayedCode(codeToShow)
      setPinSource(roomsPinReceived ? "rooms" : "backup")
      setIsWaitingForRooms(false)
      setIsLoading(false)
      setError(null) // Clear any errors since we have a working code
    }
  }, [countdown, displayedCode, passDetails?.backupCode, passDetails?.code, backupCodeCached, roomsPinReceived])

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
    let syncAttempted = false
    let pollInterval: NodeJS.Timeout | null = null
    let isMounted = true

    const fetchPassDetails = async () => {
      if (!isMounted) return

      try {
        const queryParam = sessionId ? `session_id=${sessionId}` : `payment_intent=${paymentIntent}`

        const response = await fetch(`/api/passes/by-session?${queryParam}`, {
          signal: abortController.signal,
        })

        if (!isMounted) return

        if (!response.ok) {
          const errorData = await response.json()

          // Extract backup code and metadata from error response - this is the key fallback
          const backupFromResponse = errorData.backupCode
          
          if (backupFromResponse) {
            // We have a backup code - cache it and let the countdown effect handle display
            setBackupCodeCached(backupFromResponse)
            
            // Also set partial passDetails from error response metadata
            if (errorData.accessPointName || errorData.valid_from || errorData.valid_to) {
              setPassDetails({
                pass_id: errorData.pass_id || "",
                accessPointName: errorData.accessPointName || "Access Point",
                timezone: errorData.timezone || "UTC",
                code: null,
                backupCode: backupFromResponse,
                pinSource: "backup",
                codeUnavailable: true,
                valid_from: errorData.valid_from || new Date().toISOString(),
                valid_to: errorData.valid_to || new Date().toISOString(),
                passType: errorData.passType || "Day Pass",
                vehiclePlate: errorData.vehiclePlate || "",
                device_id: errorData.device_id || "",
                returnUrl: errorData.returnUrl || null,
              })
            }
            // Don't show any errors, don't set isLoading false - let countdown effect handle it
            return
          }

          // Only show errors if we truly have NO backup code
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

          // Call sync-payment on ANY 400 error (pass not active yet) - not just when status is "pending"
          if (response.status === 400 && paymentIntent && !syncAttempted) {
            syncAttempted = true
            try {
              await fetch("/api/passes/sync-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentIntentId: paymentIntent }),
                signal: abortController.signal,
              })
            } catch (syncError) {
              console.error("Error syncing payment:", syncError instanceof Error ? syncError.message : String(syncError))
            }

            // One retry after sync
            if (isMounted) {
              pollInterval = setTimeout(() => fetchPassDetails(), 3000)
              return
            }
          }

          // If we've already tried sync and still getting errors, show error message
          if (errorData.status === "pending" || errorData.paymentStatus === "pending") {
            setError(`Lock not connected. Contact ${supportEmail}`)
            setIsLoading(false)
          } else {
            setError(extractErrorMessage(errorData) || "Unable to load pass details")
            setIsLoading(false)
          }
          return
        }

        const data = await response.json()

        if (!isMounted) return

        // Handle pincode display logic - cache any available code
        const codeToCache = data.code || data.backupCode
        if (codeToCache) {
          setBackupCodeCached(codeToCache)
          if (data.pinSource === "rooms") {
            setRoomsPinReceived(true)
          }
        }
        
        // Only show PIN after countdown reaches 0
        if (countdown === 0 && !displayedCode && codeToCache) {
          setDisplayedCode(codeToCache)
          setPinSource(data.pinSource || "backup")
          setIsWaitingForRooms(false)
        }

        if ((data.code === null && !data.backupCode) || data.codeUnavailable) {
          setCodeWarning(true)
        }

setPassDetails(data)
  setIsLoading(false)
  
  // Fetch wallet URL when pass details loaded
  if (data.pass_id && walletEnabled) {
    fetchGoogleWalletUrl(data.pass_id)
  }
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

    const validUntilDate = new Date(passDetails.valid_to).toLocaleDateString("en-AU", {
      timeZone: passDetails.timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    
    const isCampingPass = passDetails.passType?.toLowerCase().includes("camping")
    const validUntilTime = isCampingPass ? "10:00 AM" : "11:59 PM"

    const message = `Your Access Pass:
Access Point: ${passDetails.accessPointName}
PIN: ${displayedCode || "Contact support"}
Valid until: ${validUntilTime} on ${validUntilDate}

${displayedCode ? "Enter PIN followed by # at the keypad to access." : `Please contact ${supportEmail} for your PIN.`}`

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
              <CardDescription className="text-sm">
                {displayedCode ? "Your pass is ready" : "Your pass is being created"}
              </CardDescription>
            </>
          ) : (
            <CardTitle className="text-xl">Invalid Payment Details</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-2 pb-2">
          {/* Show animated countdown timer while waiting for Rooms PIN - independent of loading state */}
          {isWaitingForRooms && countdown > 0 && !displayedCode && (
            <div className="text-center">
              <AnimatedCountdown
                seconds={countdown}
                totalSeconds={COUNTDOWN_SECONDS}
                label="Generating your PIN..."
                sublabel="Connecting to access system..."
              />
            </div>
          )}

          {/* Show loading spinner only when loading AND countdown is done AND no code yet */}
          {isLoading && !displayedCode && (!isWaitingForRooms || countdown <= 0) && (
            <div className="text-center py-4">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
              <p className="mt-2 text-sm text-muted-foreground">Loading your pass...</p>
            </div>
          )}

          {error && !displayedCode && (
            <Alert variant="destructive" className="py-1.5">
              <AlertTriangle className="h-3 w-3" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* Show PIN immediately when available, even without full passDetails */}
          {displayedCode && (
            <div className="space-y-2">
              <div className="bg-primary/10 p-3 rounded-lg text-center border-2 border-primary/20">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Your Access PIN</p>
                <p className="text-4xl font-bold tracking-widest text-primary">{displayedCode}</p>
                {pinSource === "backup" && (
                  <p className="text-xs text-orange-600 mt-1 font-medium">Backup Code</p>
                )}
                <p className="text-sm font-semibold text-primary mt-2 bg-yellow-100 border border-yellow-400 rounded px-2 py-1">
                  Enter PIN followed by <span className="text-lg">#</span>
                </p>
              </div>
            </div>
          )}
          
          {passDetails && (
            <div className="space-y-2">
              {codeWarning && !displayedCode && (
                <Alert className="border-orange-500 bg-orange-50 py-1">
                  <AlertTriangle className="h-3 w-3 text-orange-600" />
                  <AlertDescription className="text-orange-800 text-xs">
                    Your pass is active but we couldn&apos;t retrieve your PIN. Please contact {supportEmail}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Show PIN placeholder only when we have passDetails but no code yet and NOT waiting for countdown */}
              {!displayedCode && !isWaitingForRooms && (
                <div className="bg-primary/10 p-3 rounded-lg text-center border-2 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Your Access PIN</p>
                  <p className="text-2xl font-bold tracking-widest text-muted-foreground">----</p>
                  <p className="text-xs text-muted-foreground mt-1">PIN unavailable</p>
                </div>
              )}


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
                  <span className="font-medium">
                    {new Date(passDetails.valid_to).toLocaleDateString("en-AU", { 
                      timeZone: passDetails.timezone, 
                      day: "numeric", 
                      month: "short", 
                      year: "numeric" 
                    })}, {passDetails.passType?.toLowerCase().includes("camping") ? "10:00 AM" : "11:59 PM"}
                  </span>
                </div>
                {passDetails.vehiclePlate && (
                  <div className="flex justify-between py-0.5 border-b">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className="font-medium">{passDetails.vehiclePlate}</span>
                  </div>
                )}
              </div>

              <Alert className="py-1.5 bg-blue-50 border-blue-200">
                <AlertDescription className="text-xs leading-tight">
                  <strong>Instructions:</strong>{" "}
                  {displayedCode
                    ? `Enter your PIN followed by # at the keypad at ${passDetails.accessPointName}. Your pass is valid until ${passDetails.passType?.toLowerCase().includes("camping") ? "10:00 AM" : "11:59 PM"} on ${new Date(passDetails.valid_to).toLocaleDateString("en-AU", { timeZone: passDetails.timezone, day: "numeric", month: "short", year: "numeric" })}.`
                    : isWaitingForRooms
                      ? "Retrieving your PIN..."
                      : `Your pass is active. Please contact ${supportEmail} to receive your PIN.`}
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                {displayedCode && (
                  <Button variant="outline" onClick={handleShareSMS} className="w-full bg-transparent text-xs h-8">
                    <MessageSquare className="mr-1 h-3 w-3" />
                    Share via SMS
                  </Button>
                )}

                {/* Wallet Buttons - only shown when NEXT_PUBLIC_WALLET_ENABLED=true */}
                {walletEnabled && displayedCode && (
                  <div className="flex gap-2">
                    {googleWalletUrl ? (
                      <a
                        href={googleWalletUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full bg-transparent text-xs h-8">
                          <img
                            src="/add-to-google-wallet.svg"
                            alt="Add to Google Wallet"
                            className="h-4 mr-1"
                          />
                          Google Wallet
                        </Button>
                      </a>
                    ) : walletLoading ? (
                      <Button variant="outline" className="flex-1 bg-transparent text-xs h-8" disabled>
                        Loading...
                      </Button>
                    ) : null}
                  </div>
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
