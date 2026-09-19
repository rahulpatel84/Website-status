import { type NextRequest, NextResponse } from "next/server"
import {
  getPublicServiceHistory,
  type PublicHistoryRange,
} from "@/lib/public-service-history"
import { getPublicService } from "@/lib/public-service-monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ranges = new Set<PublicHistoryRange>(["24h", "7d", "30d", "6m"])

export async function GET(request: NextRequest) {
  const serviceSlug = request.nextUrl.searchParams.get("service")?.trim() ?? ""
  const requestedRange = request.nextUrl.searchParams.get("range") ?? "24h"

  if (!getPublicService(serviceSlug)) {
    return NextResponse.json({ error: "Unknown public service" }, { status: 404 })
  }
  if (!ranges.has(requestedRange as PublicHistoryRange)) {
    return NextResponse.json(
      { error: "Range must be one of: 24h, 7d, 30d, 6m" },
      { status: 400 },
    )
  }

  try {
    const history = await getPublicServiceHistory(
      serviceSlug,
      requestedRange as PublicHistoryRange,
    )
    return NextResponse.json(history, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    })
  } catch (error) {
    console.error("Failed to read public service history", error)
    return NextResponse.json({ error: "Failed to read service history" }, { status: 500 })
  }
}

