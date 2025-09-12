import { type NextRequest, NextResponse } from "next/server"
import { getOutageStats } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companySlug = searchParams.get("company")
    const hours = Number.parseInt(searchParams.get("hours") || "24")

    if (!companySlug) {
      return NextResponse.json({ error: "Company slug is required" }, { status: 400 })
    }

    const stats = getOutageStats(companySlug, hours)

    return NextResponse.json({
      stats,
      timeframe: `${hours} hours`,
      total_reports: stats.reduce((sum, stat) => sum + stat.total_reports, 0),
    })
  } catch (error) {
    console.error("Error fetching outage stats:", error)
    return NextResponse.json({ error: "Failed to fetch outage stats" }, { status: 500 })
  }
}
