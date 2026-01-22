"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { sessionQuerySchema } from "@/lib/schemas/api.schema"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatLocalizedDateTime } from "@/lib/timezone"
import { WifiOff, MessageSquare, AlertTriangle, Copy, ChevronDown, CheckCircle2, Share2 } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

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

// Sophisticated Circular Loader Component
function CircularLoader() {
  return (
    <div className="circular-loader mx-auto">
      <svg viewBox="0 0 50 50" className="w-14 h-14">
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="3"
          stroke="#001F3F"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
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
  
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [isWaitingForRooms, setIsWaitingForRooms] = useState(true)
  const [roomsPinReceived, setRoomsPinReceived] = useState(false)
  const [displayedCode, setDisplayedCode] = useState<string | null>(null)
  const [pinSource, setPinSource] = useState<"rooms" | "backup" | null>(null)
  const [backupCodeCached, setBackupCodeCached] = useState<string | null>(null)
  
  const [walletEnabled] = useState(() => process.env.NEXT_PUBLIC_WALLET_ENABLED === "true")
  const [googleWalletUrl, setGoogleWalletUrl] = useState<string | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const rawParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams])

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
      // Wallet is optional
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

  useEffect(() => {
    const codeToShow = backupCodeCached || passDetails?.backupCode || passDetails?.code
    if (countdown === 0 && codeToShow && !displayedCode) {
      setDisplayedCode(codeToShow)
      setPinSource(roomsPinReceived ? "rooms" : "backup")
      setIsWaitingForRooms(false)
      setIsLoading(false)
      setError(null)
    }
  }, [countdown, displayedCode, passDetails?.backupCode, passDetails?.code, backupCodeCached, roomsPinReceived])

  // Send confirmation email after PIN is displayed
  useEffect(() => {
    const sendConfirmationEmail = async () => {
      if (!displayedCode || !passDetails?.pass_id || emailSent) return
      
      try {
        const response = await fetch("/api/passes/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passId: passDetails.pass_id,
            pin: displayedCode,
            pinSource,
          }),
        })
        
        if (response.ok) {
          setEmailSent(true)
        }
      } catch {
        // Email send failures are non-critical
      }
    }

    sendConfirmationEmail()
  }, [displayedCode, passDetails?.pass_id, emailSent, pinSource])

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
    let pinRetryCount = 0
    const MAX_PIN_RETRIES = 3
    const PIN_RETRY_DELAY_MS = Number(process.env.NEXT_PUBLIC_PASS_FETCH_BASE_DELAY_MS) || 8000

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
          const backupFromResponse = errorData.backupCode
          
          if (backupFromResponse) {
            setBackupCodeCached(backupFromResponse)
            
            if (errorData.accessPointName || errorData.valid_from || errorData.valid_to) {
              setPassDetails({
                pass_id: errorData.pass_id || "",
                accessPointName: errorData.accessPointName || "Access Point",
                timezone: errorData.timezone || "Australia/Sydney",
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
            return
          }

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

            if (isMounted) {
              pollInterval = setTimeout(() => fetchPassDetails(), 3000)
              return
            }
          }

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

        // Check if we got a Rooms PIN code
        const hasRoomsPin = data.code && data.pinSource === "rooms"
        const hasAnyCode = data.code || data.backupCode
        
        // If no Rooms PIN yet and we haven't exhausted retries, poll again
        if (!hasRoomsPin && pinRetryCount < MAX_PIN_RETRIES && isMounted) {
          pinRetryCount++
          
          // Cache backup code in case retries fail
          if (data.backupCode && !backupCodeCached) {
            setBackupCodeCached(data.backupCode)
          }
          
          // Store pass details but keep loading for PIN
          setPassDetails(data)
          
          // Schedule retry
          pollInterval = setTimeout(() => fetchPassDetails(), PIN_RETRY_DELAY_MS)
          return
        }
        
        // Retries exhausted or PIN received
        const codeToCache = data.code || data.backupCode
        if (codeToCache) {
          setBackupCodeCached(codeToCache)
          if (data.pinSource === "rooms") {
            setRoomsPinReceived(true)
          }
        }
        
        // Display code immediately if countdown finished or we have Rooms PIN
        if ((countdown === 0 || hasRoomsPin) && !displayedCode && codeToCache) {
          setDisplayedCode(codeToCache)
          setPinSource(data.pinSource || "backup")
          setIsWaitingForRooms(false)
        }

        if ((data.code === null && !data.backupCode) || data.codeUnavailable) {
          setCodeWarning(true)
        }

        setPassDetails(data)
        setIsLoading(false)
        
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
  }, [isValid, sessionId, paymentIntent, isOffline, supportEmail, rawParams, paramsValidation.error, countdown, displayedCode, walletEnabled, fetchGoogleWalletUrl])

  const formatDateTime = (dateString: string, timezone: string) => {
    return formatLocalizedDateTime(dateString, timezone)
  }

  const handleShare = async () => {
    if (!passDetails) return

    const validUntilDate = new Date(passDetails.valid_to).toLocaleDateString("en-AU", {
      timeZone: passDetails.timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    
    const isCampingPass = passDetails.passType?.toLowerCase().includes("camping")
    const validUntilTime = isCampingPass ? "10:00 AM" : "11:59 PM"

    const message = `Your Zezamii Pass:
Access Point: ${passDetails.accessPointName}
PIN: ${displayedCode || "Contact support"}
Valid until: ${validUntilTime} on ${validUntilDate}

${displayedCode ? "Enter PIN followed by # at the keypad to access." : `Please contact ${supportEmail} for your PIN.`}`

    // Try native Web Share API first (works on mobile - WhatsApp, SMS, etc.)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Zezamii Pass Details",
          text: message,
        })
        return
      } catch (err) {
        // User cancelled or share failed - fall through to SMS fallback
        if (err instanceof Error && err.name === "AbortError") {
          return // User cancelled, don't fallback
        }
      }
    }
    
    // Fallback to SMS for browsers without Web Share API
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

  // Calculate countdown progress
  const countdownProgress = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100

  const handleShareSMS = handleShare;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#1e293b] overflow-y-auto">
      {/* Slim Top Utility Bar - 44px for Operational Pages */}
      <div className="fixed top-0 left-0 right-0 h-11 bg-[#020617] flex items-center justify-between px-4 z-50 border-b border-white/10">
        <div className="flex items-center gap-2">
          <img src="/zezamii-logo.png" alt="Zezamii" className="w-5 h-5 rounded" />
          <span className="text-white font-semibold text-xs uppercase tracking-widest">Zezamii Pass</span>
        </div>
        <div className="flex items-center gap-2">
          <img src="/images/griffith-boat-club-logo.png" alt="Griffith Boat Club" className="w-6 h-6 rounded-full bg-white border border-white/20" />
          <span className="font-medium text-white text-xs">Griffith Boat Club</span>
        </div>
      </div>

      <div className="pt-14 px-4" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        {/* Status Header */}
        <div className="text-center mb-4">
          {displayedCode ? (
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#f0fdf4] mb-2">
              <CheckCircle2 className="w-6 h-6 text-[#22c55e]" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 mb-2">
              <img src="/zezamii-icon-dark.png" alt="Zezamii" className="w-14 h-14 rounded-xl" />
            </div>
          )}
          <h1 className="text-xl font-bold text-[#020617] tracking-tight">
            {isValid ? (displayedCode ? "Payment Successful" : "Processing...") : "Invalid Payment"}
          </h1>
          <p className="text-slate-500 text-sm">
            {displayedCode ? "Your digital pass is ready" : "Creating your access pass"}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 max-w-md mx-auto">
          
          {/* Loading State with Circular Loader */}
          {isWaitingForRooms && countdown > 0 && !displayedCode && (
            <div className="text-center py-3">
              <div className="relative w-14 h-14 mx-auto mb-3">
                <CircularLoader />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-[#020617]">{countdown}</span>
                </div>
              </div>
              <p className="text-base font-semibold text-[#020617]">Generating your PIN...</p>
              <p className="text-sm text-slate-500">Connecting to access system</p>
              
              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#020617] rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${countdownProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Fallback Loading */}
          {isLoading && !displayedCode && (!isWaitingForRooms || countdown <= 0) && (
            <div className="text-center py-3">
              <CircularLoader />
              <p className="mt-2 text-sm text-slate-500">Loading your pass...</p>
            </div>
          )}

          {/* Error State */}
          {error && !displayedCode && (
            <Alert variant="destructive" className="rounded-xl border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* PIN Display - Digital Member Card */}
          {displayedCode && (
            <div>
              <div className="member-card rounded-xl p-4 mb-4">
                <div className="relative z-10">
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">Access PIN</p>
                  <p className="pin-display text-5xl text-white inline-block">
                    {displayedCode}
                  </p>
                  {pinSource === "backup" && (
                    <p className="text-xs text-white/80 mt-2 font-medium">Backup Code</p>
                  )}
                </div>
              </div>
              
              <div className="bg-[#fef9c3] border border-[#fde047] rounded-xl px-3 py-2 mb-4">
                <p className="text-sm font-semibold text-[#001F3F] text-center">
                  Enter PIN followed by <span className="text-base font-bold">#</span> at keypad
                </p>
              </div>
            </div>
          )}
          
          {/* Pass Details */}
          {passDetails && (
            <div className="space-y-4">
              {codeWarning && !displayedCode && (
                <Alert className="border-orange-300 bg-orange-50 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <AlertDescription className="text-orange-700 text-sm">
                    Your pass is active but we couldn&apos;t retrieve your PIN. Contact {supportEmail}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Pass Info Grid */}
              <div className="bg-[#f8fafc] rounded-xl p-4">
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <p className="text-xs text-[#64748b]">Access Point</p>
                    <p className="text-sm font-semibold text-[#001F3F]">{passDetails.accessPointName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b]">Pass Type</p>
                    <p className="text-sm font-semibold text-[#001F3F]">{passDetails.passType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b]">Valid From</p>
                    <p className="text-sm font-medium text-[#001F3F]">{formatDateTime(passDetails.valid_from, passDetails.timezone)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b]">Valid Until</p>
                    <p className="text-sm font-medium text-[#001F3F]">{formatDateTime(passDetails.valid_to, passDetails.timezone)}</p>
                  </div>
                  {passDetails.vehiclePlate && (
                    <div className="col-span-2">
                      <p className="text-xs text-[#64748b]">Vehicle</p>
                      <p className="text-sm font-medium text-[#001F3F]">{passDetails.vehiclePlate}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {displayedCode && (
                  <Button 
                    variant="outline" 
                    onClick={handleShare} 
                    className="flex-1 h-11 rounded-xl text-sm border-[#e2e8f0] text-[#001F3F] hover:bg-[#f8fafc] bg-transparent btn-premium"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                )}

                {walletEnabled && displayedCode && googleWalletUrl && (
                  <a href={googleWalletUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button 
                      variant="outline" 
                      className="w-full h-11 rounded-xl text-sm border-[#e2e8f0] text-[#001F3F] hover:bg-[#f8fafc] bg-transparent btn-premium"
                    >
                      <img src="/add-to-google-wallet.svg" alt="" className="h-4 mr-2" />
                      Wallet
                    </Button>
                  </a>
                )}
              </div>

              {/* Confirmation Info */}
              <div className="bg-[#f8fafc] rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#64748b]">Your access details have been sent to your email.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#64748b]">A payment receipt has been emailed to you.</p>
                </div>
                <div className="pt-2 border-t border-[#e2e8f0]">
                  <p className="text-sm font-semibold text-[#001F3F]">Need a GST tax invoice?</p>
                  <p className="text-sm text-[#64748b]">Contact <a href="mailto:support@zezamii.com" className="text-[#001F3F] underline">support@zezamii.com</a> and we&apos;ll send it to you.</p>
                </div>
              </div>

              <Button
                className="w-full h-12 rounded-xl text-base font-semibold bg-[#001F3F] text-white btn-premium"
                onClick={() => {
                  const url = passDetails?.returnUrl || "/"
                  window.location.replace(`${url}?t=${Date.now()}`)
                }}
              >
                Done
              </Button>
            </div>
          )}

          {/* Technical Details Collapsible */}
          {errorDetails && (
            <Collapsible open={isTechnicalDetailsOpen} onOpenChange={setIsTechnicalDetailsOpen}>
              <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] mt-3">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors">
                    <p className="font-medium text-muted-foreground text-xs">Technical Details</p>
                    <div className="flex items-center gap-2">
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
                        className={`h-3 w-3 transition-transform text-muted-foreground ${isTechnicalDetailsOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-2 pb-2 space-y-1">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs bg-white p-2 rounded-lg border border-[#e2e8f0] max-h-24 overflow-y-auto">
                      {errorDetails}
                    </pre>
                    <p className="text-muted-foreground text-xs">
                      Copy and send to <strong>{supportEmail}</strong>
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  )
}
