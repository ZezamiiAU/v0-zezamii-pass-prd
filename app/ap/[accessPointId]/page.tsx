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
    logger.warn({ accessPointId }, "[Legacy AP] Invalid UUID format")
    notFound()
  }

  try {
    const slugData = await getAccessPointSlugs(accessPointId)

    if (!slugData) {
      logger.warn({ accessPointId }, "[Legacy AP] No active slug found for device")
      notFound()
    }

    // Build redirect URL with slug-based path
    const searchString = new URLSearchParams(search as Record<string, string>).toString()
    const newUrl = `/p/${slugData.org_slug}/${slugData.site_slug}/${slugData.accesspoint_slug}${searchString ? `?${searchString}` : ""}`

    logger.info({ accessPointId, oldUrl: `/ap/${accessPointId}`, newUrl }, "[Legacy AP] Redirecting to slug-based URL")

    redirect(newUrl)
  } catch (error) {
    if (error instanceof Error && error.message.includes("Database access misconfigured")) {
      logger.error(
        { accessPointId, error: error.message },
        "[Legacy AP] Database permission error - admin action required",
      )

      // In production, show generic error. In dev, show helpful message.
      if (process.env.NODE_ENV === "development") {
        return (
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="max-w-md space-y-4 rounded-lg border border-red-200 bg-red-50 p-6">
              <h1 className="text-lg font-semibold text-red-900">Database Configuration Error</h1>
              <p className="text-sm text-red-700">{error.message}</p>
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer font-medium">Technical Details</summary>
                <pre className="mt-2 overflow-x-auto">{JSON.stringify({ accessPointId }, null, 2)}</pre>
              </details>
            </div>
          </div>
        )
      }

      // Production: generic error
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-semibold">Service Temporarily Unavailable</h1>
            <p className="text-muted-foreground">
              We're experiencing technical difficulties. Please try again later or contact support.
            </p>
          </div>
        </div>
      )
    }

    // Unexpected errors
    logger.error(
      { accessPointId, error: error instanceof Error ? error.message : error },
      "[Legacy AP] Unexpected error processing request",
    )
    notFound()
  }
}
