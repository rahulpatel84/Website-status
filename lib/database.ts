import Database from "better-sqlite3"
import path from "path"

let db: Database.Database | null = null

export function getDatabase() {
  if (!db) {
    const dbPath = path.join(process.cwd(), "data", "outages.db")
    db = new Database(dbPath)

    // Enable WAL mode for better concurrent access
    db.pragma("journal_mode = WAL")
    // Enforce declared FOREIGN KEY constraints (SQLite ships with them OFF).
    db.pragma("foreign_keys = ON")

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

  // Scheduled availability history for the public service directory. We keep
  // three rollup levels instead of one raw row per probe: five-minute buckets
  // for the live chart, hourly buckets for 7/30-day views, and daily buckets
  // for the six-month view. Exact outage start/end times live in the incident
  // table below.
  db.exec(`
    CREATE TABLE IF NOT EXISTS public_service_status (
      service_slug TEXT PRIMARY KEY,
      current_status TEXT NOT NULL,
      response_ms INTEGER,
      http_status INTEGER,
      checked_at DATETIME NOT NULL,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS public_service_status_buckets (
      service_slug TEXT NOT NULL,
      bucket_start DATETIME NOT NULL,
      bucket_minutes INTEGER NOT NULL,
      checks INTEGER NOT NULL DEFAULT 0,
      up_checks INTEGER NOT NULL DEFAULT 0,
      down_checks INTEGER NOT NULL DEFAULT 0,
      response_samples INTEGER NOT NULL DEFAULT 0,
      response_ms_total INTEGER NOT NULL DEFAULT 0,
      response_ms_max INTEGER NOT NULL DEFAULT 0,
      latest_status TEXT NOT NULL,
      last_http_status INTEGER,
      last_checked_at DATETIME NOT NULL,
      PRIMARY KEY (service_slug, bucket_minutes, bucket_start)
    );

    CREATE INDEX IF NOT EXISTS idx_public_status_bucket_history
      ON public_service_status_buckets(service_slug, bucket_minutes, bucket_start DESC);

    CREATE TABLE IF NOT EXISTS public_service_incidents (
      id TEXT PRIMARY KEY,
      service_slug TEXT NOT NULL,
      started_at DATETIME NOT NULL,
      resolved_at DATETIME,
      cause TEXT,
      http_status INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_public_incidents_service_time
      ON public_service_incidents(service_slug, started_at DESC);
  `)

  // Anonymous comments for outage discussions
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_slug TEXT NOT NULL,
      issue_type TEXT,
      nickname TEXT,
      location TEXT,
      body TEXT NOT NULL,
      parent_id INTEGER,
      ip_hash TEXT NOT NULL,
      upvotes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'visible',
      flag_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_comments_company ON comments(company_slug, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_votes (
      comment_id INTEGER NOT NULL,
      ip_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (comment_id, ip_hash),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_flags (
      comment_id INTEGER NOT NULL,
      ip_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (comment_id, ip_hash),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
    )
  `)

  // ============================================================
  // SaaS tables — multi-tenant monitoring platform
  // ============================================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'hobby',
      owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      interval_s INTEGER NOT NULL DEFAULT 60,
      regions TEXT NOT NULL DEFAULT '["us-east"]',
      config TEXT NOT NULL DEFAULT '{}',
      is_paused INTEGER NOT NULL DEFAULT 0,
      current_status TEXT NOT NULL DEFAULT 'pending',
      last_check_at DATETIME,
      last_response_ms INTEGER,
      created_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_monitors_workspace ON monitors(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_monitors_type ON monitors(type);

    CREATE TABLE IF NOT EXISTS assertions (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      op TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_assertions_monitor ON assertions(monitor_id);

    CREATE TABLE IF NOT EXISTS probes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      region TEXT NOT NULL DEFAULT 'us-east',
      status TEXT NOT NULL,
      response_ms INTEGER,
      http_status INTEGER,
      layer_failed TEXT,
      error TEXT,
      details TEXT,
      ran_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_probes_monitor_time ON probes(monitor_id, ran_at DESC);

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      severity TEXT NOT NULL DEFAULT 'major',
      layer_isolated TEXT,
      cause TEXT,
      acknowledged_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      acknowledged_at DATETIME,
      last_notified_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_workspace_time ON incidents(workspace_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_incidents_monitor ON incidents(monitor_id);

    CREATE TABLE IF NOT EXISTS notification_channels (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      is_verified INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monitor_channels (
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
      PRIMARY KEY (monitor_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS status_pages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      accent_color TEXT NOT NULL DEFAULT '#F97316',
      logo_url TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      custom_domain TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS status_page_components (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      group_name TEXT NOT NULL DEFAULT 'Services',
      display_name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_spc_page ON status_page_components(page_id, sort_order);

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      prefix TEXT NOT NULL,
      hashed_token TEXT NOT NULL,
      last_used_at DATETIME,
      created_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_apikeys_workspace ON api_keys(workspace_id);

    CREATE TABLE IF NOT EXISTS heartbeat_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      source_ip TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_hb_monitor_time ON heartbeat_checkins(monitor_id, received_at DESC);

    CREATE TABLE IF NOT EXISTS telegram_pairings (
      code TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      chat_id TEXT
    );

    -- ============================================================
    -- Enterprise readiness — on-call + incident enrichment
    -- ============================================================

    CREATE TABLE IF NOT EXISTS on_call_schedules (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS on_call_layers (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL REFERENCES on_call_schedules(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      rotation_kind TEXT NOT NULL DEFAULT 'weekly',
      rotation_days INTEGER NOT NULL DEFAULT 7,
      handoff_time TEXT NOT NULL DEFAULT '09:00',
      members TEXT NOT NULL DEFAULT '[]',
      layer_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_layers_schedule ON on_call_layers(schedule_id, layer_order);

    CREATE TABLE IF NOT EXISTS on_call_overrides (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL REFERENCES on_call_schedules(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      start_at DATETIME NOT NULL,
      end_at DATETIME NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_overrides_schedule ON on_call_overrides(schedule_id, start_at);

    CREATE TABLE IF NOT EXISTS escalation_policies (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      steps TEXT NOT NULL DEFAULT '[]',
      repeat_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Incident enrichment: roles, timeline events, updates, follow-ups
    CREATE TABLE IF NOT EXISTS incident_roles (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_incroles_inc ON incident_roles(incident_id);

    CREATE TABLE IF NOT EXISTS incident_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      actor_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      payload TEXT,
      ts DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_incevents_inc_ts ON incident_events(incident_id, ts DESC);

    CREATE TABLE IF NOT EXISTS incident_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      author_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      body_md TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 1,
      published_to TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_incupdates_inc ON incident_updates(incident_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS incident_followups (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      owner_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      due_at DATETIME,
      status TEXT NOT NULL DEFAULT 'open',
      external_ticket TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_incfollowups_inc ON incident_followups(incident_id);

    -- Screenshot retention: one row per captured browser probe, expiring in 7 days.
    CREATE TABLE IF NOT EXISTS probe_screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      probe_id INTEGER,
      path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shots_monitor_time ON probe_screenshots(monitor_id, taken_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shots_expires ON probe_screenshots(expires_at);

    CREATE TABLE IF NOT EXISTS event_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      actor_id TEXT,
      actor_label TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      source TEXT NOT NULL,
      event TEXT NOT NULL,
      message TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      metadata TEXT,
      request_id TEXT,
      ip_hash TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_logs_ws_time ON event_logs(workspace_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_source_time ON event_logs(source, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_level_time ON event_logs(level, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_target ON event_logs(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_logs_event ON event_logs(event);
  `)

  // Structured activity log (see lib/activity-log.ts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      actor_id TEXT,
      actor_type TEXT NOT NULL DEFAULT 'system',
      actor_label TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      event TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'system',
      target_type TEXT,
      target_id TEXT,
      message TEXT NOT NULL,
      metadata TEXT,
      request_id TEXT,
      ip_hash TEXT,
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_activity_ws_created ON activity_logs(workspace_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_event ON activity_logs(event);
    CREATE INDEX IF NOT EXISTS idx_activity_level ON activity_logs(level);
    CREATE INDEX IF NOT EXISTS idx_activity_category ON activity_logs(category, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_target ON activity_logs(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
  `)

  // Lightweight column additions for existing DBs. `CREATE TABLE IF NOT EXISTS`
  // above won't add columns to a table that already exists, so we check and
  // ALTER individually. Wrap each in try/catch so a re-run on a migrated DB
  // is a no-op.
  addColumnIfMissing("incidents", "last_notified_at", "DATETIME")

  // Per-channel notification timing. Lets each notification channel have its
  // own renotify cadence (e.g. email every 4h, telegram every 30m) without
  // stepping on the incident-wide clock.
  db.exec(`
    CREATE TABLE IF NOT EXISTS incident_channel_notifications (
      incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
      last_notified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notify_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (incident_id, channel_id)
    );
    CREATE INDEX IF NOT EXISTS idx_incident_channel_notif_last
      ON incident_channel_notifications(incident_id, last_notified_at);
  `)
}

function addColumnIfMissing(table: string, column: string, decl: string) {
  if (!db) return
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (cols.some((c) => c.name === column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`)
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

// ---------- Comments ----------

export interface CommentRow {
  id: number
  company_slug: string
  issue_type: string | null
  nickname: string | null
  location: string | null
  body: string
  parent_id: number | null
  ip_hash: string
  upvotes: number
  status: "visible" | "hidden" | "flagged"
  flag_count: number
  created_at: string
}

export interface CommentWithReplies extends CommentRow {
  replies: CommentRow[]
}

export interface InsertCommentInput {
  company_slug: string
  issue_type?: string | null
  nickname?: string | null
  location?: string | null
  body: string
  parent_id?: number | null
  ip_hash: string
  status?: "visible" | "hidden" | "flagged"
}

export function insertComment(input: InsertCommentInput): CommentRow {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO comments (
      company_slug, issue_type, nickname, location, body, parent_id, ip_hash, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    input.company_slug,
    input.issue_type ?? null,
    input.nickname ?? null,
    input.location ?? null,
    input.body,
    input.parent_id ?? null,
    input.ip_hash,
    input.status ?? "visible",
  )

  const selectStmt = db.prepare(`SELECT * FROM comments WHERE id = ?`)
  return selectStmt.get(result.lastInsertRowid) as CommentRow
}

export function getCommentsForCompany(company_slug: string, limit = 100): CommentWithReplies[] {
  const db = getDatabase()

  // One parent query
  const parentStmt = db.prepare(`
    SELECT * FROM comments
    WHERE company_slug = ?
      AND parent_id IS NULL
      AND status = 'visible'
    ORDER BY created_at DESC
    LIMIT ?
  `)
  const parents = parentStmt.all(company_slug, limit) as CommentRow[]

  if (parents.length === 0) return []

  // One reply query for all parents
  const placeholders = parents.map(() => "?").join(",")
  const replyStmt = db.prepare(`
    SELECT * FROM comments
    WHERE parent_id IN (${placeholders})
      AND status = 'visible'
    ORDER BY created_at ASC
  `)
  const replies = replyStmt.all(...parents.map((p) => p.id)) as CommentRow[]

  const byParent = new Map<number, CommentRow[]>()
  for (const r of replies) {
    if (r.parent_id == null) continue
    const arr = byParent.get(r.parent_id) ?? []
    arr.push(r)
    byParent.set(r.parent_id, arr)
  }

  return parents.map((p) => ({ ...p, replies: byParent.get(p.id) ?? [] }))
}

export function voteOnComment(comment_id: number, ip_hash: string): number {
  const db = getDatabase()

  const tx = db.transaction((cid: number, hash: string) => {
    const insertVote = db.prepare(`
      INSERT OR IGNORE INTO comment_votes (comment_id, ip_hash) VALUES (?, ?)
    `)
    insertVote.run(cid, hash)

    // Recount to keep the upvotes column consistent
    const countRow = db.prepare(`SELECT COUNT(*) as c FROM comment_votes WHERE comment_id = ?`).get(cid) as { c: number }
    db.prepare(`UPDATE comments SET upvotes = ? WHERE id = ?`).run(countRow.c, cid)
    return countRow.c
  })

  return tx(comment_id, ip_hash) as number
}

export function flagComment(comment_id: number, ip_hash: string): { flag_count: number; hidden: boolean } {
  const db = getDatabase()

  const tx = db.transaction((cid: number, hash: string) => {
    const insertFlag = db.prepare(`
      INSERT OR IGNORE INTO comment_flags (comment_id, ip_hash) VALUES (?, ?)
    `)
    insertFlag.run(cid, hash)

    const countRow = db.prepare(`SELECT COUNT(*) as c FROM comment_flags WHERE comment_id = ?`).get(cid) as { c: number }
    const hidden = countRow.c >= 5
    db.prepare(
      `UPDATE comments SET flag_count = ?, status = CASE WHEN ? THEN 'hidden' ELSE status END WHERE id = ?`,
    ).run(countRow.c, hidden ? 1 : 0, cid)
    return { flag_count: countRow.c, hidden }
  })

  return tx(comment_id, ip_hash) as { flag_count: number; hidden: boolean }
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
