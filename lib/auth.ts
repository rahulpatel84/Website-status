// Auth wrapper. Uses Clerk when CLERK_SECRET_KEY is set. Otherwise falls
// back to a cookie-based dev user so the whole app works out-of-the-box.
import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"
import { getDatabase } from "./database"
import { recordActivity } from "./activity-log"

export const HAS_CLERK = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
)

export interface AuthUser {
  id: string
  email: string
  name: string
  imageUrl?: string
}

export interface AuthWorkspace {
  id: string
  name: string
  slug: string
  plan: string
  role: "owner" | "admin" | "member" | "viewer"
}

// -------- Clerk mode --------
async function clerkCurrentUser(): Promise<AuthUser | null> {
  const { currentUser } = await import("@clerk/nextjs/server")
  const u = await currentUser()
  if (!u) return null
  return {
    id: u.id,
    email: u.emailAddresses[0]?.emailAddress ?? "",
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || (u.username ?? "User"),
    imageUrl: u.imageUrl ?? undefined,
  }
}

// -------- Dev-mode fallback --------
const DEV_COOKIE = "sw_dev_uid"

async function devCurrentUser(): Promise<AuthUser | null> {
  const jar = cookies()
  const uid = jar.get(DEV_COOKIE)?.value
  if (!uid) return null
  const db = getDatabase()
  const row = db
    .prepare("SELECT id, email, name, image_url FROM app_users WHERE id = ?")
    .get(uid) as { id: string; email: string; name: string; image_url: string | null } | undefined
  if (!row) return null
  return { id: row.id, email: row.email, name: row.name, imageUrl: row.image_url ?? undefined }
}

/** Server-side: get the currently signed-in user, or null. */
export async function currentUser(): Promise<AuthUser | null> {
  return HAS_CLERK ? clerkCurrentUser() : devCurrentUser()
}

/** Ensure the user row exists in our db + they have a workspace. Called from /app pages. */
export async function ensureUserAndWorkspace(user: AuthUser): Promise<AuthWorkspace> {
  const db = getDatabase()

  const byId = db.prepare("SELECT id FROM app_users WHERE id = ?").get(user.id) as
    | { id: string }
    | undefined

  if (!byId) {
    const byEmail = db
      .prepare("SELECT id FROM app_users WHERE email = ?")
      .get(user.email) as { id: string } | undefined

    if (byEmail && byEmail.id !== user.id) {
      // Migrate the old (dev-mode) user id to the current auth-provider id.
      // Rewrite every FK that references the old id, then update the user row.
      // `defer_foreign_keys` batches FK enforcement to commit time so the
      // intermediate updates (which briefly reference a non-existent id) don't
      // trip the constraint mid-transaction.
      const oldId = byEmail.id
      const migrate = db.transaction(() => {
        db.pragma("defer_foreign_keys = ON")
        db.prepare(
          "UPDATE app_users SET id = ?, name = ?, image_url = ? WHERE id = ?",
        ).run(user.id, user.name, user.imageUrl ?? null, oldId)
        db.prepare("UPDATE workspaces SET owner_id = ? WHERE owner_id = ?").run(user.id, oldId)
        db.prepare("UPDATE workspace_members SET user_id = ? WHERE user_id = ?").run(user.id, oldId)
        db.prepare("UPDATE monitors SET created_by = ? WHERE created_by = ?").run(user.id, oldId)
        db.prepare("UPDATE api_keys SET created_by = ? WHERE created_by = ?").run(user.id, oldId)
        db.prepare(
          "UPDATE incidents SET acknowledged_by = ? WHERE acknowledged_by = ?",
        ).run(user.id, oldId)
        db.prepare("UPDATE telegram_pairings SET user_id = ? WHERE user_id = ?").run(user.id, oldId)
      })
      migrate()
    } else {
      db.prepare(
        "INSERT INTO app_users (id, email, name, image_url) VALUES (?, ?, ?, ?)",
      ).run(user.id, user.email, user.name, user.imageUrl ?? null)
    }
  }

  // Existing membership?
  const membership = db
    .prepare(
      `SELECT w.id, w.name, w.slug, w.plan, wm.role
       FROM workspace_members wm
       JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.user_id = ?
       ORDER BY w.created_at ASC LIMIT 1`,
    )
    .get(user.id) as
    | { id: string; name: string; slug: string; plan: string; role: AuthWorkspace["role"] }
    | undefined

  if (membership) return membership

  // Bootstrap a workspace on first login.
  const wsId = "ws_" + randomUUID().slice(0, 12)
  const baseSlug = (user.name || user.email.split("@")[0] || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "workspace"
  let slug = baseSlug
  let n = 1
  while (db.prepare("SELECT 1 FROM workspaces WHERE slug = ?").get(slug)) {
    slug = `${baseSlug}-${n++}`
  }
  db.prepare(
    "INSERT INTO workspaces (id, name, slug, plan, owner_id) VALUES (?, ?, ?, 'hobby', ?)",
  ).run(wsId, `${user.name}'s workspace`, slug, user.id)
  db.prepare(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')",
  ).run(wsId, user.id)
  return { id: wsId, name: `${user.name}'s workspace`, slug, plan: "hobby", role: "owner" }
}

/** Guarantees a user + workspace. Throws (redirect elsewhere) if not signed in. */
export async function requireAuth(): Promise<{ user: AuthUser; workspace: AuthWorkspace }> {
  const user = await currentUser()
  if (!user) throw new Error("UNAUTHENTICATED")
  const workspace = await ensureUserAndWorkspace(user)
  return { user, workspace }
}

/**
 * When Clerk is the auth, log an `auth.signin` activity row once per Clerk
 * session so Sessions & sign-in activity isn't empty. Idempotent: uses an
 * in-process cache first, then falls back to a targeted DB dedupe.
 * Callers should ensure this runs only after `ensureUserAndWorkspace`.
 */
const seenSessions = new Set<string>()
export async function recordClerkSessionIfNew(
  user: AuthUser,
  workspace: AuthWorkspace,
) {
  if (!HAS_CLERK) return
  let sessionId: string | null = null
  try {
    const { auth } = await import("@clerk/nextjs/server")
    const a = auth()
    sessionId = a?.sessionId ?? null
  } catch {
    return
  }
  if (!sessionId) return
  if (seenSessions.has(sessionId)) return

  try {
    const db = getDatabase()
    const seen = db
      .prepare(
        "SELECT 1 FROM activity_logs WHERE target_type = 'session' AND target_id = ? LIMIT 1",
      )
      .get(sessionId)
    if (seen) {
      seenSessions.add(sessionId)
      return
    }
    recordActivity({
      workspaceId: workspace.id,
      actorId: user.id,
      actorType: "user",
      actorLabel: user.name,
      level: "info",
      event: "auth.signin",
      category: "auth",
      targetType: "session",
      targetId: sessionId,
      message: `${user.name} signed in`,
      metadata: { provider: "clerk", session_id: sessionId },
    })
    seenSessions.add(sessionId)
  } catch {
    /* logging must never break the request */
  }
}

// -------- Dev mode: manual login helpers (used by /sign-in and /sign-up) --------

export async function devSignInOrCreate(email: string, name: string): Promise<AuthUser> {
  if (HAS_CLERK) throw new Error("dev-signin not allowed with Clerk enabled")
  const db = getDatabase()
  const existing = db
    .prepare("SELECT id, email, name, image_url FROM app_users WHERE email = ?")
    .get(email) as { id: string; email: string; name: string; image_url: string | null } | undefined
  let user: AuthUser
  if (existing) {
    user = { id: existing.id, email: existing.email, name: existing.name, imageUrl: existing.image_url ?? undefined }
  } else {
    const id = "usr_" + randomUUID().slice(0, 12)
    db.prepare("INSERT INTO app_users (id, email, name) VALUES (?, ?, ?)").run(id, email, name)
    user = { id, email, name }
  }
  const jar = cookies()
  jar.set(DEV_COOKIE, user.id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  })
  await ensureUserAndWorkspace(user)
  return user
}

export async function devSignOut() {
  const jar = cookies()
  jar.delete(DEV_COOKIE)
}
