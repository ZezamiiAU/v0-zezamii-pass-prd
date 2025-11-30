"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SuccessError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[v0] Success page error:", error)
  }, [error])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0B1E3D 0%, #1a3a5c 100%)" }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unable to load pass</CardTitle>
          <CardDescription>There was a problem retrieving your pass details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your payment may still be processing. Please check your email for confirmation or contact support.
          </p>
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              Try again
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/")} className="flex-1">
              Go home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
