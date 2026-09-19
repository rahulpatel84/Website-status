// Database adapter — selects sqlite (local dev) or Supabase Postgres (prod)
// based on env at request time. All writes go through this shim so a request
// handler doesn't need to know which store is behind it.
//
// This is intentionally minimal — it exposes the subset of query shapes
// actually used by the app. Full parity with better-sqlite3's synchronous
// prepare()/get()/all()/run() surface is impossible against Supabase's async
// REST API, so callers using this adapter must be `await`ed.
//
// **Status:** Skeleton + Postgres wiring for the hottest paths. The full
// 55-file cutover from lib/database.ts's `getDatabase()` to this adapter is
// tracked in DEPLOYMENT.md.
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type StorageMode = "sqlite" | "supabase"

export function storageMode(): StorageMode {
  const forced = process.env.DATABASE_MODE?.toLowerCase()
  if (forced === "sqlite") return "sqlite"
  if (forced === "supabase") return "supabase"
  // Auto: use Supabase when running in prod with keys set, otherwise sqlite.
  const hasCreds = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
  if (process.env.NODE_ENV === "production" && hasCreds) return "supabase"
  return "sqlite"
}

let cachedClient: SupabaseClient | null = null

/**
 * Lazily construct a service-role Supabase client. Never called at import time
 * so builds without creds don't blow up.
 */
export function supabase(): SupabaseClient {
  if (cachedClient) return cachedClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Supabase creds missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, " +
        "or force DATABASE_MODE=sqlite for local dev.",
    )
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
}

/** True if writes should be async-Supabase-shaped instead of sync-sqlite-shaped. */
export function usePostgres(): boolean {
  return storageMode() === "supabase"
}
