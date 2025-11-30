import { NextResponse } from "next/server"
import { getActivePassTypes } from "@/lib/db/pass-types"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get("orgId") || undefined

    const passTypes = await getActivePassTypes(orgId)
    return NextResponse.json(passTypes)
  } catch (error) {
    console.error("[v0] Failed to fetch pass types:", error)
    return NextResponse.json({ error: "Failed to fetch pass types" }, { status: 500 })
  }
}
