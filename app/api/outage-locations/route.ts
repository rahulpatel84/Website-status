import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companySlug = searchParams.get("company")
    const hours = Number.parseInt(searchParams.get("hours") || "24")

    if (!companySlug) {
      return NextResponse.json({ error: "Company slug is required" }, { status: 400 })
    }

    const db = getDatabase()

    // Get location-based outage data for heat map
    const locationStmt = db.prepare(`
      SELECT 
        city,
        state,
        country,
        latitude,
        longitude,
        COUNT(*) as report_count,
        issue_type,
        MAX(created_at) as latest_report
      FROM outage_reports 
      WHERE company_slug = ? 
        AND created_at >= datetime('now', '-${hours} hours')
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      GROUP BY city, state, country, latitude, longitude, issue_type
      ORDER BY report_count DESC
    `)

    const locationData = locationStmt.all(companySlug)

    // Get aggregated stats by location
    const statsStmt = db.prepare(`
      SELECT 
        country,
        state,
        COUNT(*) as total_reports,
        COUNT(DISTINCT city) as cities_affected
      FROM outage_reports 
      WHERE company_slug = ? 
        AND created_at >= datetime('now', '-${hours} hours')
        AND country IS NOT NULL
      GROUP BY country, state
      ORDER BY total_reports DESC
    `)

    const statsData = statsStmt.all(companySlug)

    return NextResponse.json({
      locations: locationData,
      stats: statsData,
      timeframe: `${hours} hours`,
    })
  } catch (error) {
    console.error("Error fetching outage locations:", error)
    return NextResponse.json({ error: "Failed to fetch outage locations" }, { status: 500 })
  }
}
