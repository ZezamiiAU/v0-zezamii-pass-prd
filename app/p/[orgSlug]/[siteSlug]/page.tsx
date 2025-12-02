import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function SitePage({
  params,
}: {
  params: Promise<{ orgSlug: string; siteSlug: string }>
}) {
  const { orgSlug, siteSlug } = await params

  console.log("[v0] SitePage accessed with orgSlug:", orgSlug, "siteSlug:", siteSlug)

  const supabase = await createClient()

  // Try to find a device with this slug under this org
  const { data: device } = await supabase
    .from("core.devices")
    .select("slug, site_id, core.sites!inner(slug, org_id, core.organisations!inner(slug))")
    .eq("slug", siteSlug)
    .eq("core.sites.core.organisations.slug", orgSlug)
    .single()

  if (device) {
    // This is an old-format URL: /p/{org}/{device}
    // Redirect to new format: /p/{org}/{site}/{device}
    const site = Array.isArray(device["core.sites"]) ? device["core.sites"][0] : device["core.sites"]

    const queryString = typeof window !== "undefined" ? window.location.search : ""
    const newUrl = `/p/${orgSlug}/${site.slug}/${siteSlug}${queryString}`

    console.log("[v0] Redirecting old URL format to:", newUrl)
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
