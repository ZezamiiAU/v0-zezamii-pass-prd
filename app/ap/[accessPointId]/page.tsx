import { redirect, notFound } from "next/navigation"
import { getAccessPointSlugs } from "@/lib/server/access-points"
import logger from "@/lib/logger"

interface Props {
  params: Promise<{ accessPointId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LegacyAccessPointPage({ params, searchParams }: Props) {
  const { accessPointId } = await params
  const search = await searchParams

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(accessPointId)) {
    logger.info({ accessPointId }, "[Legacy AP] Invalid UUID format")
    notFound()
  }

  const slugData = await getAccessPointSlugs(accessPointId)

  if (!slugData) {
    logger.info({ accessPointId }, "[Legacy AP] No active slug found for device")
    notFound()
  }

  // Build redirect URL with slug-based path
  const searchString = new URLSearchParams(search as Record<string, string>).toString()
  const newUrl = `/p/${slugData.org_slug}/${slugData.site_slug}/${slugData.accesspoint_slug}${
    searchString ? `?${searchString}` : ""
  }`

  logger.info({ accessPointId, oldUrl: `/ap/${accessPointId}`, newUrl }, "[Legacy AP] Redirecting to slug-based URL")

  redirect(newUrl)
}
