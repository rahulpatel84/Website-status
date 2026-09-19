import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { DiagnosticWaterfall } from "@/components/monitor/diagnostic-waterfall"

interface KeyRow {
  id: string
  label: string
  prefix: string
}

export default async function AgentPage() {
  const { workspace } = await requireAuth()
  const db = getDatabase()
  const keys = db
    .prepare("SELECT id, label, prefix FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC")
    .all(workspace.id) as KeyRow[]

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Install the agent in your project
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          One line to add. Automatic diagnostic waterfall for every check.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4 min-w-0">
          <Step title="1. Install">
            <CodeBlock>{`# npm
npm install @statuswatch/agent

# or pnpm / bun / yarn
pnpm add @statuswatch/agent`}</CodeBlock>
          </Step>

          <Step title="2. Initialize once, at the top of your entry file">
            <CodeBlock>{`// index.ts
import { Statuswatch } from "@statuswatch/agent";

const sw = Statuswatch.init({
  project: "acme-prod",
  token:   process.env.STATUSWATCH_TOKEN, // paste your project token
  endpoint: "${appUrl}",
  dependencies: {
    postgres: () => db.raw("select 1"),
    stripe:   () => fetch("https://api.stripe.com/v1/ping"),
    redis:    () => redis.ping(),
  },
});`}</CodeBlock>
          </Step>

          <Step title="3. Add a health route (recommended)">
            <CodeBlock>{`// Express
app.get("/health", sw.expressHealth());

// Or manually
app.get("/health", async (_, res) => {
  const report = await sw.diagnose();
  res.status(report.ok ? 200 : 503).json(report);
});`}</CodeBlock>
            <p className="text-xs text-muted-foreground mt-2">
              Point your <b>URL monitor</b> at <code className="font-mono">/health</code>. When it
              fails, the response body tells us <b>which layer</b> broke (DNS/TCP/TLS/HTTP/DB/upstream).
            </p>
          </Step>

          <Step title="4. Wrap your cron / worker jobs">
            <CodeBlock>{`import { Statuswatch } from "@statuswatch/agent";

const job = Statuswatch.job("nightly-backup");

await job.run(async () => {
  await backupToS3();
});
// job.run() auto-calls .start() before + .complete() / .fail() after.`}</CodeBlock>
          </Step>

          <Step title="5. Or use raw curl heartbeat (no SDK required)">
            <CodeBlock>{`## end of your cron
0 3 * * * /usr/bin/backup.sh && \\
  curl -fsS -m 10 --retry 3 "${appUrl}/api/heartbeat/<monitor_id>"`}</CodeBlock>
          </Step>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-2">Your project tokens</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Rotate any time from{" "}
              <Link href="/app/settings" className="text-[color:var(--brand-700)] hover:underline">
                Settings
              </Link>
              .
            </p>
            {keys.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No keys yet — create one in Settings.
              </p>
            ) : (
              <ul className="space-y-2">
                {keys.map((k) => (
                  <li key={k.id} className="text-xs">
                    <div className="font-semibold">{k.label}</div>
                    <code className="font-mono text-muted-foreground">{k.prefix}••••</code>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Diagnostic waterfall</h3>
            <p className="text-xs text-muted-foreground mb-3">
              On failure the agent probes each layer and stops at the first broken one.
            </p>
            <DiagnosticWaterfall />
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">SDK status</h3>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--status-up)]" />
                <span className="flex-1">Node.js</span>
                <span className="text-muted-foreground">v0.1 · stable</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--status-up)]" />
                <span className="flex-1">curl / heartbeat</span>
                <span className="text-muted-foreground">works everywhere</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--status-degraded)]" />
                <span className="flex-1">Python</span>
                <span className="text-muted-foreground">beta</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                <span className="flex-1">Go / Ruby / PHP</span>
                <span className="text-muted-foreground">coming</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg bg-[#0A0A0A] text-neutral-100 text-xs font-mono p-4 overflow-x-auto whitespace-pre">
      {children}
    </pre>
  )
}
