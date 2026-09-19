import Link from "next/link"
import {
  ShieldCheck,
  FileText,
  Server,
  Lock,
  Clock,
  AlertTriangle,
  Globe,
  Users,
  Database,
  Mail,
} from "lucide-react"

export const metadata = {
  title: "Trust Center · status.watch",
  description:
    "Security posture, compliance certifications, SLA, DPA, subprocessors, and incident-disclosure policy for status.watch.",
}

const SUBPROCESSORS = [
  { name: "Vercel", purpose: "Application hosting", region: "US / EU", url: "https://vercel.com" },
  { name: "Supabase", purpose: "Managed Postgres", region: "US / EU", url: "https://supabase.com" },
  { name: "Clerk", purpose: "Auth + SSO", region: "US", url: "https://clerk.com" },
  { name: "Resend", purpose: "Email delivery", region: "US", url: "https://resend.com" },
  { name: "Cloudflare", purpose: "CDN + DDoS", region: "Global", url: "https://cloudflare.com" },
  { name: "Fly.io", purpose: "Probe workers", region: "Global", url: "https://fly.io" },
  { name: "Telegram", purpose: "Alert delivery (opt-in)", region: "Global", url: "https://telegram.org" },
]

const COMPLIANCE = [
  { label: "SOC 2 Type II", status: "In progress · report Q1 2027", color: "degraded" },
  { label: "ISO 27001", status: "Planned Q3 2027", color: "muted" },
  { label: "GDPR / SCCs", status: "DPA available on request", color: "up" },
  { label: "HIPAA", status: "BAA on request (Team plan)", color: "muted" },
  { label: "PCI DSS", status: "Not in scope — we do not process card data", color: "muted" },
  { label: "FedRAMP", status: "Not currently pursued", color: "muted" },
]

const SLA_TIERS = [
  { tier: "Hobby (free)", uptime: "Best-effort", credits: "None" },
  { tier: "Pro ($19/mo)", uptime: "99.9%", credits: "10% credit per full hour of downtime, up to 30%" },
  { tier: "Team ($79/mo)", uptime: "99.95%", credits: "25% credit per 30 min of downtime, up to 100%" },
  { tier: "Enterprise", uptime: "99.99%", credits: "Custom, contractual" },
]

const SECURITY_POSTURE = [
  {
    icon: Lock,
    title: "Encryption in transit and at rest",
    body: "All customer traffic uses TLS 1.2+. Data at rest is encrypted with AES-256 at the disk layer by our hosting providers. IP addresses attached to comments/reports are salted-SHA-256 hashed before storage.",
  },
  {
    icon: Users,
    title: "Access control",
    body: "Least-privilege access for our staff. Production DB access requires MFA. SSO (SAML) + SCIM 2.0 available on Enterprise for your team.",
  },
  {
    icon: Database,
    title: "Data residency",
    body: "Workspace region is pinned at creation (US or EU). Cross-region replication is opt-in per workspace.",
  },
  {
    icon: Clock,
    title: "Retention & deletion",
    body: "Probe results retained 30/90/365 days per plan. Incidents retained 3 years. Audit log retained 1 year. Right-to-deletion honored within 30 days of written request.",
  },
  {
    icon: Server,
    title: "Backup & DR",
    body: "Point-in-time recovery on Postgres via Supabase. Daily encrypted snapshots retained 7 days. Recovery Point Objective 5 minutes, Recovery Time Objective 2 hours.",
  },
  {
    icon: AlertTriangle,
    title: "Incident disclosure",
    body: "Security incidents materially affecting customer data are disclosed within 72 hours via email to workspace owners and a public entry on this page.",
  },
]

export default function TrustCenterPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:px-6 py-12 md:py-16">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-500)]/40 bg-[color:var(--brand-50)] text-[color:var(--brand-700)] text-xs font-semibold px-3 py-1 mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          Trust & Security
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Trust Center
        </h1>
        <p className="text-lg text-muted-foreground mt-3 max-w-2xl">
          Security posture, compliance status, SLA, subprocessors, and how we handle your data. If
          you need a document under NDA (SOC 2 report, pen-test summary, security questionnaire),
          email{" "}
          <a
            className="text-[color:var(--brand-700)] hover:underline"
            href="mailto:security@statuswatch.io"
          >
            security@statuswatch.io
          </a>
          .
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">Security posture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SECURITY_POSTURE.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-[color:var(--brand-700)]" />
                  <h3 className="text-sm font-semibold">{s.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">
          Compliance certifications
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-5 py-2 font-semibold">Certification</th>
                <th className="text-left px-5 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {COMPLIANCE.map((c) => (
                <tr key={c.label} className="border-t border-border">
                  <td className="px-5 py-3 font-semibold">{c.label}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <span
                      className={
                        "inline-flex items-center gap-1.5 rounded-full border text-xs font-semibold px-2 py-0.5 mr-2 " +
                        (c.color === "up"
                          ? "text-[color:var(--status-up)] border-[color:var(--status-up)]/30 bg-[color:var(--status-up)]/10"
                          : c.color === "degraded"
                            ? "text-[color:var(--status-degraded)] border-[color:var(--status-degraded)]/40 bg-[color:var(--status-degraded)]/10"
                            : "text-muted-foreground border-border bg-muted")
                      }
                    >
                      <span
                        className={
                          "w-1.5 h-1.5 rounded-full " +
                          (c.color === "up"
                            ? "bg-[color:var(--status-up)]"
                            : c.color === "degraded"
                              ? "bg-[color:var(--status-degraded)]"
                              : "bg-muted-foreground")
                        }
                      />
                      {c.color === "up"
                        ? "Available"
                        : c.color === "degraded"
                          ? "In progress"
                          : "Planned"}
                    </span>
                    {c.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">Uptime SLA</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-5 py-2 font-semibold">Plan</th>
                <th className="text-left px-5 py-2 font-semibold">Guaranteed uptime</th>
                <th className="text-left px-5 py-2 font-semibold">Credits</th>
              </tr>
            </thead>
            <tbody>
              {SLA_TIERS.map((t) => (
                <tr key={t.tier} className="border-t border-border">
                  <td className="px-5 py-3 font-semibold">{t.tier}</td>
                  <td className="px-5 py-3 font-mono">{t.uptime}</td>
                  <td className="px-5 py-3 text-muted-foreground">{t.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Live status of the status.watch platform itself is published at{" "}
          <Link href="/status/statuswatch" className="text-[color:var(--brand-700)] hover:underline">
            status.statuswatch.io
          </Link>
          .
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">Subprocessors</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
          The third parties we rely on to deliver the service. We give at least 30 days' notice via
          email when the list changes materially.
        </p>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-5 py-2 font-semibold">Vendor</th>
                <th className="text-left px-5 py-2 font-semibold">Purpose</th>
                <th className="text-left px-5 py-2 font-semibold">Region</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((v) => (
                <tr key={v.name} className="border-t border-border">
                  <td className="px-5 py-3 font-semibold">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[color:var(--brand-700)] hover:underline"
                    >
                      {v.name}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{v.purpose}</td>
                  <td className="px-5 py-3 text-muted-foreground">{v.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DocCard
            icon={FileText}
            title="Data Processing Addendum"
            desc="GDPR-compliant DPA with EU Standard Contractual Clauses. Countersigned within 5 business days."
            action="Request via security@"
          />
          <DocCard
            icon={FileText}
            title="Security Questionnaire (SIG Lite / CAIQ)"
            desc="Pre-answered SIG Lite and CAIQ v4 available under NDA."
            action="Request via security@"
          />
          <DocCard
            icon={FileText}
            title="Pen-test summary"
            desc="Annual third-party penetration test. Executive summary available under NDA."
            action="Request via security@"
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-3">
          <Mail className="w-4 h-4 text-[color:var(--brand-700)]" />
          <h2 className="text-sm font-semibold">Contact</h2>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>
            Security disclosures:{" "}
            <a
              className="text-[color:var(--brand-700)] hover:underline"
              href="mailto:security@statuswatch.io"
            >
              security@statuswatch.io
            </a>{" "}
            (PGP key on request)
          </li>
          <li>
            Privacy / DPA:{" "}
            <a
              className="text-[color:var(--brand-700)] hover:underline"
              href="mailto:privacy@statuswatch.io"
            >
              privacy@statuswatch.io
            </a>
          </li>
          <li>
            General procurement:{" "}
            <a
              className="text-[color:var(--brand-700)] hover:underline"
              href="mailto:sales@statuswatch.io"
            >
              sales@statuswatch.io
            </a>
          </li>
        </ul>
      </section>

      <p className="text-xs text-muted-foreground mt-8">
        Last updated 2026-09-06. This page reflects the current state — read it, then talk to us.
      </p>
    </div>
  )
}

function DocCard({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: any
  title: string
  desc: string
  action: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[color:var(--brand-700)]" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{desc}</p>
      <div className="text-xs text-[color:var(--brand-700)] font-semibold">{action}</div>
    </div>
  )
}
