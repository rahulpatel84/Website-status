import { Card } from "@/components/ui/card"

type Method = "GET" | "POST" | "SSE"

type Endpoint = {
  method: Method
  path: string
  description: React.ReactNode
}

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/check-status?url=",
    description: (
      <>
        Live HTTP HEAD check against a URL. 10s timeout. Returns{" "}
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          {"{ up, statusCode, responseTimeMs }"}
        </code>
        .
      </>
    ),
  },
  {
    method: "GET",
    path: "/api/outage-stats?company=&hours=24",
    description:
      "Hourly aggregated report counts by issue type for the given service.",
  },
  {
    method: "GET",
    path: "/api/outage-locations?company=&hours=6",
    description: "Geo-tagged reports for the heatmap. Returns lat/lng + city.",
  },
  {
    method: "GET",
    path: "/api/outage-city-reports?company=&city=",
    description:
      "City-level breakdown of reports with issue-type tags.",
  },
  {
    method: "POST",
    path: "/api/report-outage",
    description: (
      <>
        Submit an outage report. Rate limited to 3/min per hashed IP. Body:{" "}
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          {"{ company_slug, issue_type }"}
        </code>
        .
      </>
    ),
  },
  {
    method: "SSE",
    path: "/api/events?company=",
    description: (
      <>
        Server-sent events stream. Emits{" "}
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          report.new
        </code>
        ,{" "}
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          comment.new
        </code>
        ,{" "}
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          status.changed
        </code>
        .
      </>
    ),
  },
]

function MethodPill({ method }: { method: Method }) {
  const styles: Record<Method, string> = {
    GET: "bg-[color:var(--status-up)]/10 text-[color:var(--status-up)] border-[color:var(--status-up)]/30",
    POST: "bg-[color:var(--brand-50)] text-[color:var(--brand-700)] border-[color:var(--brand-500)]/30",
    SSE: "bg-blue-50 text-blue-700 border-blue-300",
  }
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold font-mono ${styles[method]}`}
    >
      {method}
    </span>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Public API
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Free, no key required for read endpoints. JSON everywhere.
          CORS-enabled.
        </p>

        <Card className="p-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">
              Base URL
            </span>
            <div className="flex-1" />
            <span className="font-mono text-sm">
              https://status.watch/api
            </span>
          </div>
        </Card>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-1">Endpoints</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Existing routes from the app, documented for public use.
          </p>

          <div className="space-y-3">
            {endpoints.map((ep) => (
              <Card key={ep.path} className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <MethodPill method={ep.method} />
                  <span className="font-mono text-sm break-all">
                    {ep.path}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {ep.description}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Example</h2>
          <Card className="p-4 bg-muted/40">
            <pre className="font-mono text-xs md:text-sm whitespace-pre-wrap break-all">
{`curl -s https://status.watch/api/outage-stats?company=instagram&hours=24`}
            </pre>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Rate limits &amp; terms</h2>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>60 requests/min per IP for read endpoints.</li>
            <li>3 POSTs/min per hashed IP for reporting.</li>
            <li>
              Attribution appreciated but not required. Please don&apos;t scrape
              aggressively.
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
