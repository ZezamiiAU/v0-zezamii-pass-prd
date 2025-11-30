import { Suspense } from "react"
import { notFound } from "next/navigation"
import { PassPurchaseForm } from "@/components/pass-purchase-form"
import { Spinner } from "@/components/ui/spinner"
import { createServiceClient } from "@/lib/supabase/server"

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

  const supabase = createServiceClient()

  console.log("[v0] Querying for:", { orgSlug, deviceSlug })

  const { data: accessPoint, error } = await supabase
    .schema("pass")
    .from("v_accesspoint_details")
    .select("*")
    .eq("org_slug", orgSlug)
    .eq("slug", deviceSlug)
    .eq("is_active", true)
    .single()

  if (error || !accessPoint) {
    console.error("[v0] Access point lookup failed:", {
      error: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      orgSlug,
      deviceSlug,
    })
    notFound()
  }

  console.log("[v0] Found access point:", {
    deviceId: accessPoint.device_id,
    accesspointName: accessPoint.accesspoint_name,
    orgName: accessPoint.org_name,
  })

  if (qr) {
    try {
      await supabase
        .schema("analytics")
        .from("qr_scans")
        .insert({
          qr_instance_id: qr,
          device_id: accessPoint.device_id,
          org_id: accessPoint.org_id,
          source: source || "qr",
          scanned_at: new Date().toISOString(),
        })
      console.log("[v0] QR scan tracked:", qr)
    } catch (qrError) {
      console.error("[v0] QR tracking failed (non-fatal):", qrError)
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
          organizationId={accessPoint.org_id}
          organizationName={accessPoint.org_name}
          organizationLogo={accessPoint.org_logo_url}
          siteId={accessPoint.site_id}
          siteName={accessPoint.site_name}
          deviceId={accessPoint.device_id}
          deviceName={accessPoint.accesspoint_name}
          deviceDescription={accessPoint.site_description}
        />
      </Suspense>
    </main>
  )
}
