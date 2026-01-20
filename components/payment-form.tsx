"use client"

import React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface PaymentFormProps {
  returnUrl: string
  customerEmail?: string
}

function PaymentFormBase({ returnUrl, customerEmail }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      })

      if (error) {
        setErrorMessage(error.message || "An error occurred during payment")
        setIsProcessing(false)
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        router.push(`/success?payment_intent=${paymentIntent.id}`)
      } else {
        setErrorMessage("Payment processing failed. Please try again.")
        setIsProcessing(false)
      }
    } catch (err) {
      setErrorMessage("An unexpected error occurred")
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border border-[#e2e8f0] p-4 bg-white">
        <PaymentElement
          options={{
            defaultValues: {
              billingDetails: {
                email: customerEmail || "",
              },
            },
          }}
        />
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-200 p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full h-14 rounded-3xl text-base font-semibold bg-[#001F3F] text-white hover:bg-[#0a3d62] disabled:opacity-50"
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (
          "Pay Now"
        )}
      </Button>
    </form>
  )
}

export const PaymentForm = React.memo(PaymentFormBase)
