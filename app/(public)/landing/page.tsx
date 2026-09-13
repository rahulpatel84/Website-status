import Link from "next/link"
import {
  ArrowRight,
  Activity,
  HeartPulse,
  Package,
  Globe,
  FileText,
  KeyRound,
  Plug,
  ShieldCheck,
  Network,
  Server,
  Timer,
  Mail,
  Send,
  MessageSquare,
  Webhook,
  CircleDot,
} from "lucide-react"
import { Card } from "@/components/ui/card"

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12 md:py-16">
      {/* Hero */}
      <section className="text-center max-w-4xl mx-auto">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <CircleDot
            className="h-3 w-3"
            style={{ color: "var(--status-up)" }}
          />
          Free tier &middot; No credit card
        </span>
        <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
          Monitor{" "}
          <span className="text-[color:var(--brand-500)]">anything</span> —
          websites, forms, APIs, cron jobs.
        </h1>
        <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          The uptime platform your team actually enjoys. Sub-30-second checks,
          form-load probes, cron heartbeats, an install-in-your-project SDK,
          and per-service status pages you can put your own logo on.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          10 monitors, email + Telegram alerts, 1 custom status page — free
          forever.
        </p>
      </section>

      {/* Value-prop cards */}
      <section className="mt-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="p-6 gap-3">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-[color:var(--brand-50)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-700)]">
              <Activity className="h-3.5 w-3.5" />
              Uptime
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              HTTP, keyword, form &amp; port checks
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Watch any URL, verify a keyword renders, submit a form and expect
              a 200, or ping a TCP port. Every 30 seconds, from 5 regions.
            </p>
          </Card>
          <Card className="p-6 gap-3">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-[color:var(--brand-50)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-700)]">
              <HeartPulse className="h-3.5 w-3.5" />
              Heartbeats
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Dead-man&apos;s switch for cron jobs
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get a URL like{" "}
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                /hb/&lt;token&gt;
              </code>
              . Hit it at the end of your cron, backup script, or worker. If it
              goes silent, we alert.
            </p>
          </Card>
          <Card className="p-6 gap-3">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-[color:var(--brand-50)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-700)]">
              <Package className="h-3.5 w-3.5" />
              SDK
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Install-in-project agent
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              One-line{" "}
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                npm i @statuswatch/agent
              </code>
              . Auto-diagnoses which layer failed: DNS, TLS, DB, upstream API,
              or your code.
            </p>
          </Card>
        </div>
      </section>

      {/* What you can monitor */}
      <section className="mt-20">
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            What you can monitor
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every kind of &ldquo;is it working?&rdquo; question.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: Globe,
              title: "Website / URL",
              desc: "HTTP 2xx expected",
            },
            {
              icon: FileText,
              title: "Form loads",
              desc: "Selector must render",
            },
            {
              icon: KeyRound,
              title: "Keyword present",
              desc: "Word must appear",
            },
            {
              icon: Plug,
              title: "API endpoint",
              desc: "JSON schema check",
            },
            {
              icon: ShieldCheck,
              title: "SSL cert",
              desc: "Days-until-expiry",
            },
            {
              icon: Network,
              title: "Domain / DNS",
              desc: "Expiry + record drift",
            },
            {
              icon: Server,
              title: "TCP port",
              desc: "DB, SSH, custom",
            },
            {
              icon: Timer,
              title: "Cron heartbeat",
              desc: "Dead-man's switch",
            },
          ].map((t) => (
            <Card key={t.title} className="p-5 gap-2">
              <t.icon className="h-6 w-6 text-[color:var(--brand-500)]" />
              <div className="mt-1 font-semibold text-foreground">
                {t.title}
              </div>
              <div className="text-xs text-muted-foreground">{t.desc}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* Alerts where you already are */}
      <section className="mt-20">
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Alerts where you already are
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Route incidents to the channel that gets acted on.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: Mail,
              title: "Email",
              desc: "Resend-powered, deliverable",
            },
            {
              icon: Send,
              title: "Telegram",
              desc: "Personal + group chats",
            },
            {
              icon: MessageSquare,
              title: "Slack",
              desc: "Per-channel routing",
            },
            {
              icon: Webhook,
              title: "Webhooks",
              desc: "Signed, with retry",
            },
          ].map((t) => (
            <Card key={t.title} className="p-5 gap-2">
              <t.icon className="h-6 w-6 text-[color:var(--brand-500)]" />
              <div className="mt-1 font-semibold text-foreground">
                {t.title}
              </div>
              <div className="text-xs text-muted-foreground">{t.desc}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="mt-20">
        <Card className="p-8 md:p-10 gap-0 border-[color:var(--brand-100)] bg-[color:var(--brand-50)]">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[240px]">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Free while you&apos;re small.
              </h2>
              <p className="mt-2 text-sm md:text-base text-muted-foreground">
                10 monitors, 1 status page, unlimited alerts. Upgrade only when
                you outgrow us.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold"
              >
                See pricing
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
