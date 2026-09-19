-- Per-channel notification cadence + incident renotify tracking.
-- Mirrors the SQLite additions in lib/database.ts (addColumnIfMissing on
-- incidents + CREATE TABLE incident_channel_notifications).

BEGIN;

-- 1. Renotify clock on the incident itself.
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

-- 2. Per-(incident, channel) delivery timing. Lets each channel have its own
--    renotify cadence (config.notify_every_min on notification_channels).
CREATE TABLE IF NOT EXISTS incident_channel_notifications (
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  channel_id  TEXT NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notify_count     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (incident_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_incident_channel_notif_last
  ON incident_channel_notifications(incident_id, last_notified_at);

COMMIT;
