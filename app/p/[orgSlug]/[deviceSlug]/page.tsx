import { Suspense } from "react"
import { notFound } from "next/navigation"
import { PassPurchaseForm } from "@/components/pass-purchase-form"
import { Spinner } from "@/components/ui/spinner"
import { createCoreServiceClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{
    orgSlug: string
    deviceSlug: string
  }>
  searchParams: Promise<{
    qr?: string
    source?: string
  }>
}

export default async function DevicePassPage({ params, searchParams }: PageProps) {
  const { orgSlug, deviceSlug } = await params
  const { qr, source } = await searchParams

  const supabase = createCoreServiceClient()

  console.log("[v0] Querying device:", { orgSlug, deviceSlug })

  const { data: deviceData, error } = await supabase
    .from("v_accesspoint_details")
    .select("*")
    .eq("org_slug", orgSlug)
    .eq("slug", deviceSlug)
    .eq("is_active", true)
    .single()

  if (error || !deviceData) {
    console.error("[v0] Failed to resolve device:", error)
    notFound()
  }

  console.log("[v0] Device found:", deviceData.accesspoint_name)

  if (qr) {
    try {
      await supabase.from("qr_scans").insert({
        qr_instance_id: qr,
        device_id: deviceData.device_id,
        org_id: deviceData.org_id,
        source: source || "qr",
        scanned_at: new Date().toISOString(),
      })
      console.log("[v0] QR scan tracked:", qr)
    } catch (error) {
      // Don't block page load if tracking fails
      console.error("[v0] Failed to track QR scan:", error)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Spinner />
          </div>
        }
      >
        <PassPurchaseForm
          organizationId={deviceData.org_id}
          organizationName={deviceData.org_name}
          organizationLogo={deviceData.custom_logo_url}
          siteId={deviceData.site_id}
          siteName={deviceData.site_name}
          deviceId={deviceData.device_id}
          deviceName={deviceData.accesspoint_name}
          deviceDescription={deviceData.custom_description}
        />
      </Suspense>
    </main>
  )
}
