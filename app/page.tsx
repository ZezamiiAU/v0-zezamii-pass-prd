"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ENV } from "@/lib/env"

export default function HomePage() {
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)

  const { NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID } = ENV.client()
  const ENTRY_ACCESS_POINT_ID = NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID ?? "00000000-0000-0000-0000-000000000003"

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: "#002147" }}>
      <Card
        className={`w-full max-w-sm bg-white shadow-2xl transition-all duration-700 ease-out overflow-hidden ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ borderRadius: "1.5rem" }}
      >
        <div className="w-full">
          <img src="/images/image.png" alt="Lake Wyangan at Griffith Boat Club" className="w-full h-40 object-cover" />
        </div>

        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle className="text-2xl font-bold" style={{ color: "#002147" }}>
            Griffith Boat Club
          </CardTitle>
          <p className="text-gray-500 mt-1">Lake Wyangan</p>
          <p className="text-lg font-semibold mt-3" style={{ color: "#002147" }}>
            Day Pass — $25
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <div className="flex flex-col items-center gap-4" style={{ minHeight: "120px" }}>
            <img
              src="https://griffithboatclub.com/wp-content/uploads/2024/03/cropped-GBC-LOGO-3-1.png"
              alt="Griffith Boat Club"
              className="h-36 w-auto"
            />

            <Button
              size="lg"
              className="w-full text-white font-bold uppercase tracking-wide py-6 text-lg transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/40"
              style={{
                backgroundColor: "#002147",
                borderRadius: "0.75rem",
              }}
              onClick={() => router.push(`/ap/${ENTRY_ACCESS_POINT_ID}`)}
            >
              Buy Pass
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
