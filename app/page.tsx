"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Home } from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  const ENTRY_ACCESS_POINT_ID = process.env.NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID || "00000000-0000-0000-0000-000000000003"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#1e293b]">
      {/* Header with Zezamii logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 8h8M8 12h8M8 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-white text-xl font-semibold">Zezamii Pass</span>
      </div>

      <Card className="w-full max-w-sm bg-white shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="text-center pb-4 pt-8">
          <CardTitle className="text-3xl font-bold text-[#1e293b]">Day Pass</CardTitle>
          <p className="text-gray-500 mt-2">Your Site</p>
        </CardHeader>

        <CardContent className="px-6 pb-8">
          <div className="flex flex-col items-center gap-6">
            {/* Home icon as separator */}
            <Home className="w-8 h-8 text-gray-400" />

            <Button
              size="lg"
              className="w-full text-white font-bold uppercase tracking-wide py-6 text-lg bg-[#1e293b] rounded-xl hover:opacity-90 transition-all duration-300 hover:shadow-lg"
              onClick={() => router.push(`/ap/${ENTRY_ACCESS_POINT_ID}`)}
            >
              Buy Pass
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 text-gray-400 text-sm">Powered by Zezamii</p>
    </div>
  )
}
