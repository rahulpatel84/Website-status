import Database from "better-sqlite3"
import path from "path"

let db: Database.Database | null = null

export function getDatabase() {
  if (!db) {
    const dbPath = path.join(process.cwd(), "data", "outages.db")
    db = new Database(dbPath)

    // Enable WAL mode for better concurrent access
    db.pragma("journal_mode = WAL")

    // Initialize tables
    initializeTables()
  }
  return db
}

function initializeTables() {
  if (!db) return

  // Create outage reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS outage_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_slug TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      user_ip TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      latitude REAL,
      longitude REAL,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_company_slug ON outage_reports(company_slug);
    CREATE INDEX IF NOT EXISTS idx_created_at ON outage_reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_issue_type ON outage_reports(issue_type);
  `)

  // Create aggregated stats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS outage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_slug TEXT NOT NULL,
      hour_timestamp DATETIME NOT NULL,
      total_reports INTEGER DEFAULT 0,
      website_reports INTEGER DEFAULT 0,
      services_reports INTEGER DEFAULT 0,
      api_reports INTEGER DEFAULT 0,
      mobile_app_reports INTEGER DEFAULT 0,
      payment_system_reports INTEGER DEFAULT 0,
      login_reports INTEGER DEFAULT 0,
      other_reports INTEGER DEFAULT 0,
      UNIQUE(company_slug, hour_timestamp)
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stats_company_hour ON outage_stats(company_slug, hour_timestamp);
  `)
}

export interface OutageReport {
  id?: number
  company_slug: string
  issue_type: string
  user_ip?: string
  city?: string
  state?: string
  country?: string
  latitude?: number
  longitude?: number
  user_agent?: string
  created_at?: string
}

export interface OutageStats {
  company_slug: string
  hour_timestamp: string
  total_reports: number
  website_reports: number
  services_reports: number
  api_reports: number
  mobile_app_reports: number
  payment_system_reports: number
  login_reports: number
  other_reports: number
}

export interface OutageLocationStats {
  country: string
  state: string
  city: string
  latitude: number
  longitude: number
  report_count: number
  issue_types: string
  latest_report: string
  first_report: string
}

export interface TopAffectedRegions {
  region: string
  country: string
  total_reports: number
  unique_issues: number
  cities_affected: number
  latest_report: string
}

export function insertOutageReport(report: OutageReport) {
  const db = getDatabase()
  
  // LOG: Database insertion
  const dbTime = new Date()
  console.log(`🔵 DATABASE FUNCTION CALLED:`)
  console.log(`DB Function Time: ${dbTime.toLocaleString()} (${dbTime.toISOString()})`)
  console.log(`SQLite will use CURRENT_TIMESTAMP (UTC)`)
  
  const stmt = db.prepare(`
    INSERT INTO outage_reports (
      company_slug, issue_type, user_ip, city, state, country, 
      latitude, longitude, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    report.company_slug,
    report.issue_type,
    report.user_ip,
    report.city,
    report.state,
    report.country,
    report.latitude,
    report.longitude,
    report.user_agent,
  )

  // Check what was actually inserted
  const checkStmt = db.prepare(`
    SELECT id, company_slug, issue_type, created_at, 
           datetime(created_at, 'localtime') as local_time
    FROM outage_reports 
    WHERE id = ?
  `)
  const insertedRecord = checkStmt.get(result.lastInsertRowid)
  
  console.log(`📝 RECORD INSERTED INTO DATABASE:`)
  console.log(`Record ID: ${result.lastInsertRowid}`)
  console.log(`Stored UTC Time: ${insertedRecord.created_at}`)
  console.log(`Converted Local Time: ${insertedRecord.local_time}`)

  // Update hourly stats
  updateHourlyStats(report.company_slug, report.issue_type)

  return result
}

function updateHourlyStats(companySlug: string, issueType: string) {
  const db = getDatabase()
  const hourTimestamp = new Date()
  hourTimestamp.setMinutes(0, 0, 0) // Round to hour

  const columnMap: Record<string, string> = {
    website: "website_reports",
    services: "services_reports",
    api: "api_reports",
    "mobile-app": "mobile_app_reports",
    "payment-system": "payment_system_reports",
    login: "login_reports",
    other: "other_reports",
  }

  const column = columnMap[issueType] || "other_reports"

  const stmt = db.prepare(`
    INSERT INTO outage_stats (company_slug, hour_timestamp, total_reports, ${column})
    VALUES (?, ?, 1, 1)
    ON CONFLICT(company_slug, hour_timestamp) DO UPDATE SET
      total_reports = total_reports + 1,
      ${column} = ${column} + 1
  `)

  stmt.run(companySlug, hourTimestamp.toISOString())
}

export function getOutageStats(companySlug: string, hours = 24): OutageStats[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM outage_stats 
    WHERE company_slug = ? 
    AND hour_timestamp >= datetime('now', '-${hours} hours')
    ORDER BY hour_timestamp ASC
  `)

  return stmt.all(companySlug) as OutageStats[]
}

export function getOutageReports(companySlug: string, limit = 100): OutageReport[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM outage_reports 
    WHERE company_slug = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `)

  return stmt.all(companySlug, limit) as OutageReport[]
}

export function getOutageLocationStats(companySlug: string, hours = 24): OutageLocationStats[] {
  const db = getDatabase()

  const stmt = db.prepare(`
    SELECT 
      country,
      state,
      city,
      latitude,
      longitude,
      COUNT(*) as report_count,
      GROUP_CONCAT(DISTINCT issue_type) as issue_types,
      MAX(created_at) as latest_report,
      MIN(created_at) as first_report
    FROM outage_reports 
    WHERE company_slug = ? 
      AND created_at >= datetime('now', '-${hours} hours')
      AND latitude IS NOT NULL 
      AND longitude IS NOT NULL
    GROUP BY country, state, city, latitude, longitude
    HAVING report_count > 0
    ORDER BY report_count DESC, latest_report DESC
  `)

  return stmt.all(companySlug) as OutageLocationStats[]
}

export function getTopAffectedRegions(companySlug: string, hours = 24, limit = 10): TopAffectedRegions[] {
  const db = getDatabase()

  const stmt = db.prepare(`
    SELECT 
      COALESCE(state, country) as region,
      country,
      COUNT(*) as total_reports,
      COUNT(DISTINCT issue_type) as unique_issues,
      COUNT(DISTINCT city) as cities_affected,
      MAX(created_at) as latest_report
    FROM outage_reports 
    WHERE company_slug = ? 
      AND created_at >= datetime('now', '-${hours} hours')
      AND country IS NOT NULL
    GROUP BY COALESCE(state, country), country
    ORDER BY total_reports DESC
    LIMIT ?
  `)

  return stmt.all(companySlug, limit) as TopAffectedRegions[]
}

export function clearAllOutageData(companySlug?: string) {
  const db = getDatabase()
  
  if (companySlug) {
    // Clear data for specific company
    const deleteReports = db.prepare('DELETE FROM outage_reports WHERE company_slug = ?')
    const deleteStats = db.prepare('DELETE FROM outage_stats WHERE company_slug = ?')
    
    const reportsDeleted = deleteReports.run(companySlug)
    const statsDeleted = deleteStats.run(companySlug)
    
    return {
      reportsDeleted: reportsDeleted.changes,
      statsDeleted: statsDeleted.changes,
      company: companySlug
    }
  } else {
    // Clear all data
    const deleteAllReports = db.prepare('DELETE FROM outage_reports')
    const deleteAllStats = db.prepare('DELETE FROM outage_stats')
    
    const reportsDeleted = deleteAllReports.run()
    const statsDeleted = deleteAllStats.run()
    
    return {
      reportsDeleted: reportsDeleted.changes,
      statsDeleted: statsDeleted.changes,
      company: 'all'
    }
  }
}
