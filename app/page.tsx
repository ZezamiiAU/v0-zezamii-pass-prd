"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ENV } from "@/lib/env"
import Image from "next/image"

interface PassType {
  name: string
  price_cents: number
  duration_minutes: number
}

export default function HomePage() {
  const router = useRouter()
  const [passTypes, setPassTypes] = useState<PassType[]>([])
  const [orgName, setOrgName] = useState("Access Pass")
  const [siteName, setSiteName] = useState("Your Site")

  const { NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID, NEXT_PUBLIC_DEFAULT_ORG_NAME, NEXT_PUBLIC_DEFAULT_SITE_NAME } =
    ENV.client()
  const ENTRY_ACCESS_POINT_ID = NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID ?? "00000000-0000-0000-0000-000000000003"

  useEffect(() => {
    if (NEXT_PUBLIC_DEFAULT_ORG_NAME) setOrgName(NEXT_PUBLIC_DEFAULT_ORG_NAME)
    if (NEXT_PUBLIC_DEFAULT_SITE_NAME) setSiteName(NEXT_PUBLIC_DEFAULT_SITE_NAME)

    async function loadPassTypes() {
      try {
        const res = await fetch("/api/pass-types")
        if (res.ok) {
          const data = await res.json()
          setPassTypes(data.slice(0, 3)) // Show top 3 passes
        }
      } catch (error) {
        console.error("[v0] Error loading pass types:", error)
      }
    }
    loadPassTypes()
  }, [NEXT_PUBLIC_DEFAULT_ORG_NAME, NEXT_PUBLIC_DEFAULT_SITE_NAME])

  return (
    <div className="h-full overflow-hidden flex items-center justify-center p-3 relative bg-brand-gradient">
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
        <Image
          src="/images/zezamii-pass-logo.png"
          alt="Zezamii Pass"
          width={400}
          height={120}
          className="w-[400px] h-auto"
        />
      </div>

      <Card className="w-full max-w-md mt-24 md:mt-28 lg:mt-0 bg-white shadow-xl">
        <CardHeader className="text-center space-y-1 pb-2">
          <CardTitle className="text-3xl font-bold text-gray-900">Day Pass</CardTitle>
          <CardDescription className="text-lg text-gray-600">{siteName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center space-y-3">
            {passTypes.length > 0 && (
              <div className="bg-gray-100 rounded-lg p-3 space-y-1.5">
                <h3 className="font-semibold text-base text-gray-900">Available Passes</h3>
                <div className="space-y-1 text-base">
                  {passTypes.map((pass) => (
                    <div key={pass.name} className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{pass.name}</span>
                      <span className="text-gray-600">
                        {pass.duration_minutes >= 60
                          ? `${Math.floor(pass.duration_minutes / 60)} hours`
                          : `${pass.duration_minutes} min`}{" "}
                        - ${(pass.price_cents / 100).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="w-full text-white hover:opacity-90 bg-brand"
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
