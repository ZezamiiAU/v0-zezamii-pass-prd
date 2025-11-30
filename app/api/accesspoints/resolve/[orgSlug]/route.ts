import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params

  return NextResponse.json(
    {
      error: "Device slug is required",
      message: "Please provide a device slug in the URL path",
      orgSlug,
      expectedFormat: "/api/accesspoints/resolve/{orgSlug}/{deviceSlug}",
    },
    { status: 400 },
  )
}
