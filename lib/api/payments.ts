import type { CheckoutInput } from "@/lib/validation"

export async function createPaymentIntent(input: CheckoutInput, key: string) {
  const res = await fetch("/api/payment-intents", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-idempotency-key": key },
    body: JSON.stringify(input),
  })

  let json
  try {
    json = await res.json()
  } catch (parseError) {
    // If JSON parsing fails, the server returned HTML or plain text
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`Server error: ${res.status} ${res.statusText}. ${text.substring(0, 100)}`)
  }

  if (!res.ok) throw new Error(json?.error ?? "Failed to create payment intent")
  return json as { clientSecret: string }
}
