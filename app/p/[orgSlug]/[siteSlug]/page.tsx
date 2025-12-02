import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

type SiteJoin = { slug: string }
type DeviceRow = {
  slug: string
  site_id: string | null
  sites?: SiteJoin[] | SiteJoin | null
}

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; siteSlug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug, siteSlug } = await params
  const sp = searchParams ? await searchParams : {}

  const supabase = await createClient()

  // Try to find a device with this slug under this org
  const { data: device } = await supabase
    .from("core.devices")
    .select(`
      slug,
      site_id,
      sites:core.sites!inner(
        slug,
        org_id,
        core.organisations!inner(slug)
      )
    `)
    .eq("slug", siteSlug)
    .eq("sites.core.organisations.slug", orgSlug)
    .single<DeviceRow>()

  if (device) {
    // old format: /p/{org}/{device}
    // new format: /p/{org}/{site}/{device}
    const rawSites = device.sites
    const site = Array.isArray(rawSites) ? rawSites[0] : rawSites

    if (!site?.slug) {
      // device exists but site join missing somehow
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Invalid Access Point</h1>
            <p className="mt-2 text-gray-600">This device is not linked to a site.</p>
          </div>
        </div>
      )
    }

    const queryString = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((vv) => [k, vv]) : v ? [[k, v]] : []
      )
    ).toString()

    const newUrl = `/p/${orgSlug}/${site.slug}/${siteSlug}${queryString ? `?${queryString}` : ""}`
    redirect(newUrl)
  }

  // Not a device, show error page
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Invalid Access Point</h1>
        <p className="mt-2 text-gray-600">Please scan a valid QR code to access this site.</p>
      </div>
    </div>
  )
}
