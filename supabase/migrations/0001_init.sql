-- status.watch — initial Postgres schema for Supabase
-- Mirrors lib/database.ts (SQLite) so a data migration is a straight copy.
-- Apply via the Supabase SQL editor OR `supabase db push`.

BEGIN;

-- ============================================================
-- Public outage tracker (Phase 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS outage_reports (
  id         BIGSERIAL PRIMARY KEY,
  company_slug TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  user_ip    TEXT,
  city       TEXT,
  state      TEXT,
  country    TEXT,
  latitude   DOUBLE PRECISION,
  longitude  DOUBLE PRECISION,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_slug ON outage_reports(company_slug);
CREATE INDEX IF NOT EXISTS idx_created_at   ON outage_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_issue_type   ON outage_reports(issue_type);

CREATE TABLE IF NOT EXISTS outage_stats (
  id BIGSERIAL PRIMARY KEY,
  company_slug TEXT NOT NULL,
  hour_timestamp TIMESTAMPTZ NOT NULL,
  total_reports INTEGER DEFAULT 0,
  website_reports INTEGER DEFAULT 0,
  services_reports INTEGER DEFAULT 0,
  api_reports INTEGER DEFAULT 0,
  mobile_app_reports INTEGER DEFAULT 0,
  payment_system_reports INTEGER DEFAULT 0,
  login_reports INTEGER DEFAULT 0,
  other_reports INTEGER DEFAULT 0,
  UNIQUE (company_slug, hour_timestamp)
);
CREATE INDEX IF NOT EXISTS idx_stats_company_hour ON outage_stats(company_slug, hour_timestamp);

CREATE TABLE IF NOT EXISTS comments (
  id          BIGSERIAL PRIMARY KEY,
  company_slug TEXT NOT NULL,
  issue_type  TEXT,
  nickname    TEXT,
  location    TEXT,
  body        TEXT NOT NULL,
  parent_id   BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  ip_hash     TEXT NOT NULL,
  upvotes     INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'visible',
  flag_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_company ON comments(company_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent  ON comments(parent_id);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  ip_hash    TEXT   NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, ip_hash)
);

CREATE TABLE IF NOT EXISTS comment_flags (
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  ip_hash    TEXT   NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, ip_hash)
);

-- ============================================================
-- SaaS platform (Phase 2)
-- ============================================================

CREATE TABLE IF NOT EXISTS app_users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  image_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'hobby',
  owner_id   TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS monitors (
  id                TEXT PRIMARY KEY,
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  target            TEXT NOT NULL,
  method            TEXT NOT NULL DEFAULT 'GET',
  interval_s        INTEGER NOT NULL DEFAULT 60,
  regions           JSONB NOT NULL DEFAULT '["us-east"]',
  config            JSONB NOT NULL DEFAULT '{}',
  is_paused         BOOLEAN NOT NULL DEFAULT FALSE,
  current_status    TEXT NOT NULL DEFAULT 'pending',
  last_check_at     TIMESTAMPTZ,
  last_response_ms  INTEGER,
  created_by        TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monitors_workspace ON monitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_monitors_type      ON monitors(type);

CREATE TABLE IF NOT EXISTS assertions (
  id         TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  op         TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assertions_monitor ON assertions(monitor_id);

CREATE TABLE IF NOT EXISTS probes (
  id            BIGSERIAL PRIMARY KEY,
  monitor_id    TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  region        TEXT NOT NULL DEFAULT 'us-east',
  status        TEXT NOT NULL,
  response_ms   INTEGER,
  http_status   INTEGER,
  layer_failed  TEXT,
  error         TEXT,
  details       JSONB,
  ran_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_probes_monitor_time ON probes(monitor_id, ran_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id              TEXT PRIMARY KEY,
  monitor_id      TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  severity        TEXT NOT NULL DEFAULT 'major',
  layer_isolated  TEXT,
  cause           TEXT,
  acknowledged_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_incidents_workspace_time ON incidents(workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor       ON incidents(monitor_id);

CREATE TABLE IF NOT EXISTS notification_channels (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  label        TEXT NOT NULL,
  config       JSONB NOT NULL DEFAULT '{}',
  is_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitor_channels (
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (monitor_id, channel_id)
);

CREATE TABLE IF NOT EXISTS status_pages (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  accent_color  TEXT NOT NULL DEFAULT '#F97316',
  logo_url      TEXT,
  visibility    TEXT NOT NULL DEFAULT 'public',
  custom_domain TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_page_components (
  id           TEXT PRIMARY KEY,
  page_id      TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  monitor_id   TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  group_name   TEXT NOT NULL DEFAULT 'Services',
  display_name TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_spc_page ON status_page_components(page_id, sort_order);

CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  prefix        TEXT NOT NULL,
  hashed_token  TEXT NOT NULL,
  last_used_at  TIMESTAMPTZ,
  created_by    TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_apikeys_workspace ON api_keys(workspace_id);

CREATE TABLE IF NOT EXISTS heartbeat_checkins (
  id          BIGSERIAL PRIMARY KEY,
  monitor_id  TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  source_ip   TEXT
);
CREATE INDEX IF NOT EXISTS idx_hb_monitor_time ON heartbeat_checkins(monitor_id, received_at DESC);

CREATE TABLE IF NOT EXISTS telegram_pairings (
  code         TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  chat_id      TEXT
);

COMMIT;

-- ================================================================
-- Enterprise readiness — on-call + incident enrichment
-- ================================================================

CREATE TABLE IF NOT EXISTS on_call_schedules (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  timezone     TEXT NOT NULL DEFAULT 'UTC',
  created_by   TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS on_call_layers (
  id             TEXT PRIMARY KEY,
  schedule_id    TEXT NOT NULL REFERENCES on_call_schedules(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  rotation_kind  TEXT NOT NULL DEFAULT 'weekly',
  rotation_days  INTEGER NOT NULL DEFAULT 7,
  handoff_time   TEXT NOT NULL DEFAULT '09:00',
  members        JSONB NOT NULL DEFAULT '[]',
  layer_order    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_layers_schedule ON on_call_layers(schedule_id, layer_order);

CREATE TABLE IF NOT EXISTS on_call_overrides (
  id          TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES on_call_schedules(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_overrides_schedule ON on_call_overrides(schedule_id, start_at);

CREATE TABLE IF NOT EXISTS escalation_policies (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  steps        JSONB NOT NULL DEFAULT '[]',
  repeat_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_roles (
  id          TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  user_id     TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incroles_inc ON incident_roles(incident_id);

CREATE TABLE IF NOT EXISTS incident_events (
  id          BIGSERIAL PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  actor_id    TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  payload     JSONB,
  ts          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incevents_inc_ts ON incident_events(incident_id, ts DESC);

CREATE TABLE IF NOT EXISTS incident_updates (
  id           BIGSERIAL PRIMARY KEY,
  incident_id  TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id    TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  body_md      TEXT NOT NULL,
  is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  published_to JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incupdates_inc ON incident_updates(incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS incident_followups (
  id              TEXT PRIMARY KEY,
  incident_id     TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  owner_id        TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  due_at          TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'open',
  external_ticket TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incfollowups_inc ON incident_followups(incident_id);

CREATE TABLE IF NOT EXISTS probe_screenshots (
  id           BIGSERIAL PRIMARY KEY,
  monitor_id   TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  probe_id     BIGINT,
  path         TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  taken_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shots_monitor_time ON probe_screenshots(monitor_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_shots_expires ON probe_screenshots(expires_at);
