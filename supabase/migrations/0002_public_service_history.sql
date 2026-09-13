-- Six-month public-service availability history.
-- Raw probes are compacted into 5-minute, hourly, and daily buckets. Exact
-- outage start/end transitions are retained separately.

BEGIN;

CREATE TABLE IF NOT EXISTS public_service_status (
  service_slug   TEXT PRIMARY KEY,
  current_status TEXT NOT NULL CHECK (current_status IN ('up', 'down')),
  response_ms    INTEGER,
  http_status    INTEGER,
  checked_at     TIMESTAMPTZ NOT NULL,
  error          TEXT
);

CREATE TABLE IF NOT EXISTS public_service_status_buckets (
  service_slug      TEXT NOT NULL,
  bucket_start      TIMESTAMPTZ NOT NULL,
  bucket_minutes    INTEGER NOT NULL CHECK (bucket_minutes IN (5, 60, 1440)),
  checks            INTEGER NOT NULL DEFAULT 0,
  up_checks         INTEGER NOT NULL DEFAULT 0,
  down_checks       INTEGER NOT NULL DEFAULT 0,
  response_samples  INTEGER NOT NULL DEFAULT 0,
  response_ms_total BIGINT NOT NULL DEFAULT 0,
  response_ms_max   INTEGER NOT NULL DEFAULT 0,
  latest_status     TEXT NOT NULL CHECK (latest_status IN ('up', 'down')),
  last_http_status  INTEGER,
  last_checked_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (service_slug, bucket_minutes, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_public_status_bucket_history
  ON public_service_status_buckets(service_slug, bucket_minutes, bucket_start DESC);

CREATE TABLE IF NOT EXISTS public_service_incidents (
  id           TEXT PRIMARY KEY,
  service_slug TEXT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL,
  resolved_at  TIMESTAMPTZ,
  cause        TEXT,
  http_status  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_public_incidents_service_time
  ON public_service_incidents(service_slug, started_at DESC);

CREATE OR REPLACE FUNCTION record_public_service_checks(p_checks JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  check_ts TIMESTAMPTZ;
  prior_status TEXT;
  minutes INTEGER;
  bucket_ts TIMESTAMPTZ;
  response_value INTEGER;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(p_checks)
  LOOP
    check_ts := COALESCE((item->>'checked_at')::TIMESTAMPTZ, NOW());
    response_value := (item->>'response_ms')::INTEGER;

    SELECT current_status INTO prior_status
    FROM public_service_status
    WHERE service_slug = item->>'service_slug'
    FOR UPDATE;

    IF item->>'status' = 'down' AND prior_status IS DISTINCT FROM 'down' THEN
      INSERT INTO public_service_incidents (
        id, service_slug, started_at, cause, http_status
      ) VALUES (
        'pub_inc_' || substr(md5((item->>'service_slug') || check_ts::TEXT || random()::TEXT), 1, 16),
        item->>'service_slug',
        check_ts,
        item->>'error',
        (item->>'http_status')::INTEGER
      );
    ELSIF item->>'status' = 'up' AND prior_status = 'down' THEN
      UPDATE public_service_incidents
      SET resolved_at = check_ts
      WHERE id = (
        SELECT id
        FROM public_service_incidents
        WHERE service_slug = item->>'service_slug' AND resolved_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
      );
    END IF;

    INSERT INTO public_service_status (
      service_slug, current_status, response_ms, http_status, checked_at, error
    ) VALUES (
      item->>'service_slug',
      item->>'status',
      response_value,
      (item->>'http_status')::INTEGER,
      check_ts,
      item->>'error'
    )
    ON CONFLICT (service_slug) DO UPDATE SET
      current_status = EXCLUDED.current_status,
      response_ms = EXCLUDED.response_ms,
      http_status = EXCLUDED.http_status,
      checked_at = EXCLUDED.checked_at,
      error = EXCLUDED.error;

    FOREACH minutes IN ARRAY ARRAY[5, 60, 1440]
    LOOP
      bucket_ts := CASE minutes
        WHEN 5 THEN to_timestamp(floor(extract(epoch FROM check_ts) / 300) * 300)
        WHEN 60 THEN date_trunc('hour', check_ts)
        ELSE date_trunc('day', check_ts)
      END;

      INSERT INTO public_service_status_buckets (
        service_slug, bucket_start, bucket_minutes, checks, up_checks, down_checks,
        response_samples, response_ms_total, response_ms_max, latest_status,
        last_http_status, last_checked_at
      ) VALUES (
        item->>'service_slug',
        bucket_ts,
        minutes,
        1,
        CASE WHEN item->>'status' = 'up' THEN 1 ELSE 0 END,
        CASE WHEN item->>'status' = 'down' THEN 1 ELSE 0 END,
        CASE WHEN response_value IS NULL THEN 0 ELSE 1 END,
        COALESCE(response_value, 0),
        COALESCE(response_value, 0),
        item->>'status',
        (item->>'http_status')::INTEGER,
        check_ts
      )
      ON CONFLICT (service_slug, bucket_minutes, bucket_start) DO UPDATE SET
        checks = public_service_status_buckets.checks + EXCLUDED.checks,
        up_checks = public_service_status_buckets.up_checks + EXCLUDED.up_checks,
        down_checks = public_service_status_buckets.down_checks + EXCLUDED.down_checks,
        response_samples = public_service_status_buckets.response_samples + EXCLUDED.response_samples,
        response_ms_total = public_service_status_buckets.response_ms_total + EXCLUDED.response_ms_total,
        response_ms_max = GREATEST(public_service_status_buckets.response_ms_max, EXCLUDED.response_ms_max),
        latest_status = EXCLUDED.latest_status,
        last_http_status = EXCLUDED.last_http_status,
        last_checked_at = EXCLUDED.last_checked_at;
    END LOOP;
  END LOOP;

  DELETE FROM public_service_status_buckets
  WHERE bucket_minutes = 5 AND bucket_start < NOW() - INTERVAL '2 days';
  DELETE FROM public_service_status_buckets
  WHERE bucket_minutes = 60 AND bucket_start < NOW() - INTERVAL '32 days';
  DELETE FROM public_service_status_buckets
  WHERE bucket_minutes = 1440 AND bucket_start < NOW() - INTERVAL '183 days';
  DELETE FROM public_service_incidents
  WHERE resolved_at IS NOT NULL AND resolved_at < NOW() - INTERVAL '183 days';
END;
$$;

REVOKE ALL ON FUNCTION record_public_service_checks(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_public_service_checks(JSONB) TO service_role;

COMMIT;

