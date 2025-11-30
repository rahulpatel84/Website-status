import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companySlug = searchParams.get("company")
    const city = searchParams.get("city")
    const state = searchParams.get("state")
    const country = searchParams.get("country")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const hours = Number.parseInt(searchParams.get("hours") || "24")

    if (!companySlug || !city) {
      return NextResponse.json({ error: "company and city are required" }, { status: 400 })
    }

    const db = getDatabase()

    const stmt = db.prepare(`
      SELECT id, issue_type, created_at
      FROM outage_reports
      WHERE company_slug = ?
        AND city = ?
        AND (? IS NULL OR state = ?)
        AND (? IS NULL OR country = ?)
        AND created_at >= datetime('now', '-${hours} hours')
      ORDER BY created_at DESC
      LIMIT ?
    `)

    const rows = stmt.all(companySlug, city, state, state, country, country, limit)
    return NextResponse.json({ reports: rows })
  } catch (error) {
    console.error("Error fetching city reports:", error)
    return NextResponse.json({ error: "Failed to fetch city reports" }, { status: 500 })
  }
}


