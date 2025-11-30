import { Suspense } from "react"
import { redirect } from "next/navigation"
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
    .schema("core")
    .from("devices")
    .select(`
      id,
      name,
      custom_name,
      custom_description,
      custom_logo_url,
      code,
      org_id,
      site_id,
      slug,
      slug_is_active,
      organisations:org_id (
        id,
        name,
        slug,
        timezone
      ),
      sites:site_id (
        id,
        name,
        city,
        state
      )
    `)
    .eq("slug", deviceSlug)
    .eq("organisations.slug", orgSlug)
    .eq("slug_is_active", true)
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

    const errorParams = new URLSearchParams({
      orgSlug,
      deviceSlug,
      errorMessage: error?.message || "No data returned",
      errorCode: error?.code || "UNKNOWN",
      errorDetails: error?.details || "N/A",
      errorHint: error?.hint || "N/A",
    })

    redirect(`/p/error?${errorParams.toString()}`)
  }

  const org = Array.isArray(accessPoint.organisations) ? accessPoint.organisations[0] : accessPoint.organisations

  const site = Array.isArray(accessPoint.sites) ? accessPoint.sites[0] : accessPoint.sites

  console.log("[v0] Found access point:", {
    deviceId: accessPoint.id,
    deviceName: accessPoint.custom_name || accessPoint.name,
    orgName: org?.name,
  })

  if (qr) {
    try {
      await supabase
        .schema("analytics")
        .from("qr_scans")
        .insert({
          qr_instance_id: qr,
          device_id: accessPoint.id,
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
          organizationName={org?.name || "Organization"}
          organizationLogo={accessPoint.custom_logo_url}
          siteId={accessPoint.site_id}
          siteName={site?.name || "Site"}
          deviceId={accessPoint.id}
          deviceName={accessPoint.custom_name || accessPoint.name}
          deviceDescription={accessPoint.custom_description}
        />
      </Suspense>
    </main>
  )
}
