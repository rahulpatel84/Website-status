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
    
    // Get individual reports with exact timestamps for accurate chart display
    const reportsStmt = db.prepare(`
      SELECT 
        created_at,
        issue_type,
        1 as report_count
      FROM outage_reports 
      WHERE company_slug = ? 
        AND created_at >= datetime('now', '-${hours} hours')
      ORDER BY created_at ASC
    `)

    const reports = reportsStmt.all(companySlug)

    // Also get summary stats
    const summaryStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN issue_type = 'website' THEN 1 END) as website_reports,
        COUNT(CASE WHEN issue_type = 'services' THEN 1 END) as services_reports,
        COUNT(CASE WHEN issue_type = 'api' THEN 1 END) as api_reports,
        COUNT(CASE WHEN issue_type = 'mobile-app' THEN 1 END) as mobile_app_reports,
        COUNT(CASE WHEN issue_type = 'payment-system' THEN 1 END) as payment_system_reports,
        COUNT(CASE WHEN issue_type = 'login' THEN 1 END) as login_reports,
        COUNT(CASE WHEN issue_type = 'other' THEN 1 END) as other_reports
      FROM outage_reports 
      WHERE company_slug = ? 
        AND created_at >= datetime('now', '-${hours} hours')
    `)

    const summary = summaryStmt.get(companySlug)

    return NextResponse.json({
      reports,
      summary,
      timeframe: `${hours} hours`,
      total_reports: summary?.total_reports || 0,
    })
  } catch (error) {
    console.error("Error fetching outage stats:", error)
    return NextResponse.json({ error: "Failed to fetch outage stats" }, { status: 500 })
  }
}
