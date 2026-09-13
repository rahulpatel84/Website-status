import Link from "next/link"
import { requireAuth, HAS_CLERK } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { queryActivityLogs } from "@/lib/activity-log"
import { KeyManager } from "./key-manager"
import { SignOutButton } from "@/components/app-shell/sign-out-button"
import { WorkspaceNameForm } from "./workspace-form"
import { ClerkProfileEmbed } from "./clerk-profile-embed"

interface KeyRow {
  id: string
  label: string
  prefix: string
  last_used_at: string | null
  created_at: string
}

export default async function SettingsPage() {
  const { user, workspace } = await requireAuth()
  const db = getDatabase()
  const keys = db
    .prepare(
      "SELECT id, label, prefix, last_used_at, created_at FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC",
    )
    .all(workspace.id) as KeyRow[]

  const authLog = queryActivityLogs({
    workspaceId: workspace.id,
    category: "auth",
    actorId: user.id,
    limit: 10,
    offset: 0,
  })

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Profile, workspace, API keys, and billing.
        </p>
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Profile</h2>
            <SignOutButton />
          </div>
          {HAS_CLERK ? (
            <ClerkProfileEmbed />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Name" value={user.name} readOnly />
                <Field label="Email" value={user.email} readOnly />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Dev-mode account. Add Clerk keys to .env.local to enable name /
                email / password changes.
              </p>
            </>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Workspace</h2>
          <WorkspaceNameForm
            initialName={workspace.name}
            slug={workspace.slug}
            plan={workspace.plan}
            role={workspace.role}
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-1">API keys</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Use these to authenticate SDK installs and REST calls.
          </p>
          <KeyManager keys={keys} />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-2">Billing</h2>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-500)]/40 bg-[color:var(--brand-50)] text-[color:var(--brand-700)] text-xs font-semibold px-2 py-0.5">
              Plan: {workspace.plan}
            </span>
            <div className="text-xs text-muted-foreground">
              Free forever · payment method: none
            </div>
            <div className="ml-auto">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Sessions & sign-in activity</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {HAS_CLERK
                  ? "Manage devices and revoke sessions from your Clerk profile. Recent auth events for this account are shown below."
                  : "Dev-mode accounts don't have per-device sessions. Sign in/out events for this account are shown below."}
              </p>
            </div>
            {HAS_CLERK ? (
              <a
                href="#/security"
                className="shrink-0 inline-flex items-center h-9 px-4 rounded-md border border-input text-sm font-semibold"
                title="Jump to the Security tab in your embedded profile above"
              >
                Manage devices ↑
              </a>
            ) : null}
          </div>
          {authLog.logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No recorded sign-in activity yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {authLog.logs.map((row) => (
                <li key={row.id} className="py-2 flex items-center gap-3 text-sm">
                  <span
                    className={
                      "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wider " +
                      (row.event.includes("signout")
                        ? "bg-muted text-muted-foreground"
                        : "bg-[color:var(--brand-50)] text-[color:var(--brand-700)]")
                    }
                  >
                    {row.event.replace("auth.", "")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-foreground">{row.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                      {row.ip_hash ? ` · device ${row.ip_hash.slice(0, 8)}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex justify-end">
            <Link
              href="/app/logs?category=auth"
              className="text-xs font-semibold text-[color:var(--brand-700)] hover:underline"
            >
              See full auth history →
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-2">Audit log</h2>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm font-semibold">Every meaningful action, immutable</div>
              <div className="text-xs text-muted-foreground">
                Retained 1 year. Filter by category / level / target. Available via API.
              </div>
            </div>
            <Link
              href="/app/settings/audit"
              className="ml-auto inline-flex items-center h-9 px-4 rounded-md border border-input text-sm font-semibold"
            >
              Open audit log →
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-[color:var(--status-down)]/40 bg-card p-5">
          <h2 className="text-sm font-semibold text-[color:var(--status-down)] mb-2">
            Danger zone
          </h2>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm font-semibold">Delete workspace</div>
              <div className="text-xs text-muted-foreground">
                Permanently remove all monitors, incidents, and status pages.
              </div>
            </div>
            <button
              disabled
              className="ml-auto inline-flex items-center h-9 px-4 rounded-md border border-[color:var(--status-down)]/40 text-[color:var(--status-down)] text-sm font-semibold opacity-60 cursor-not-allowed"
            >
              Delete workspace
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  readOnly = false,
}: {
  label: string
  value: string
  readOnly?: boolean
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1.5">{label}</label>
      <input
        defaultValue={value}
        readOnly={readOnly}
        className="w-full h-9 rounded-md border border-input px-3 text-sm disabled:opacity-70"
      />
    </div>
  )
}
