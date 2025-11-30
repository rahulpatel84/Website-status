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
        AVG(latitude) as latitude,
        AVG(longitude) as longitude,
        COUNT(*) as report_count,
        MAX(created_at) as latest_report
      FROM outage_reports 
      WHERE company_slug = ? 
        AND created_at >= datetime('now', '-${hours} hours')
        AND country IS NOT NULL
      GROUP BY city, state, country
      HAVING AVG(latitude) IS NOT NULL AND AVG(longitude) IS NOT NULL
      ORDER BY report_count DESC
    `)

    let locationData = locationStmt.all(companySlug) as any[]

    // Prefer the most granular city-level points: if a broad metro (e.g., London)
    // and a smaller town (e.g., Hounslow) both appear in the same state/country,
    // keep the smaller towns and drop the broad metro entry to avoid overlap.
    const genericCityNames = new Set(['Unknown','N/A'])

    const grouped: Record<string, any[]> = {}
    for (const row of locationData) {
      const key = `${row.state || ''}|${row.country || ''}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(row)
    }

    const filtered: any[] = []
    for (const key of Object.keys(grouped)) {
      const rows = grouped[key]
      if (rows.length <= 1) {
        filtered.push(...rows)
        continue
      }
      const nonGeneric = rows.filter((r) => r.city && !genericCityNames.has(String(r.city)))
      if (nonGeneric.length > 0) {
        filtered.push(...nonGeneric)
      } else {
        filtered.push(...rows)
      }
    }
    locationData = filtered

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
