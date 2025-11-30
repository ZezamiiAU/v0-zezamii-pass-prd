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

  // Join through: devices → floors → buildings → sites → organisations
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
      slug,
      slug_is_active,
      floor_id,
      floors:floor_id (
        id,
        building_id,
        buildings:building_id (
          id,
          site_id,
          sites:site_id (
            id,
            name,
            city,
            state,
            org_id,
            organisations:org_id (
              id,
              name,
              slug,
              timezone
            )
          )
        )
      )
    `)
    .eq("slug", deviceSlug)
    .eq("slug_is_active", true)
    .eq("floors.buildings.sites.organisations.slug", orgSlug)
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

  const floor = Array.isArray(accessPoint.floors) ? accessPoint.floors[0] : accessPoint.floors
  const building = floor && (Array.isArray(floor.buildings) ? floor.buildings[0] : floor.buildings)
  const site = building && (Array.isArray(building.sites) ? building.sites[0] : building.sites)
  const org = site && (Array.isArray(site.organisations) ? site.organisations[0] : site.organisations)

  if (!org) {
    console.error("[v0] Organization not found in joined data")

    const errorParams = new URLSearchParams({
      orgSlug,
      deviceSlug,
      errorMessage: "Organization not found",
      errorCode: "ORG_NOT_FOUND",
      errorDetails: "The organization data could not be retrieved",
      errorHint: "Check that the device is properly linked to an organization",
    })

    redirect(`/p/error?${errorParams.toString()}`)
  }

  console.log("[v0] Found access point:", {
    deviceId: accessPoint.id,
    deviceName: accessPoint.custom_name || accessPoint.name,
    orgName: org?.name,
    siteName: site?.name,
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
          siteId={site?.id}
          siteName={site?.name || "Site"}
          deviceId={accessPoint.id}
          deviceName={accessPoint.custom_name || accessPoint.name}
          deviceDescription={accessPoint.custom_description}
        />
      </Suspense>
    </main>
  )
}
