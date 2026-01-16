"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  const router = useRouter()

  const ENTRY_ACCESS_POINT_ID = process.env.NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID || "00000000-0000-0000-0000-000000000003"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#002147]">
      <Card className="w-full max-w-sm bg-white shadow-2xl overflow-hidden rounded-3xl">
        <div className="w-full">
          <img src="/images/image.png" alt="Lake Wyangan at Griffith Boat Club" className="w-full h-40 object-cover" />
        </div>

        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle className="text-2xl font-bold text-[#002147]">Griffith Boat Club</CardTitle>
          <p className="text-gray-500 mt-1">Lake Wyangan</p>
          <p className="text-lg font-semibold mt-3 text-[#002147]">Day Pass — $25</p>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <div className="flex flex-col items-center gap-4" style={{ minHeight: "120px" }}>
            <img src="/images/griffith-boat-club-logo.jpg" alt="Griffith Boat Club" className="h-36 w-auto" />

            <Button
              size="lg"
              className="w-full text-white font-bold uppercase tracking-wide py-6 text-lg bg-[#002147] rounded-xl hover:opacity-90 transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/40"
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
