"use client"

import React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
        const successUrl = customerEmail 
          ? `/success?payment_intent=${paymentIntent.id}&customer_email=${encodeURIComponent(customerEmail)}`
          : `/success?payment_intent=${paymentIntent.id}`
        router.push(successUrl)
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          defaultValues: {
            billingDetails: {
              email: customerEmail || "",
            },
          },
        }}
      />

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full bg-brand text-white hover:opacity-90"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? "Processing..." : "Pay Now"}
      </Button>
    </form>
  )
}

export const PaymentForm = React.memo(PaymentFormBase)
