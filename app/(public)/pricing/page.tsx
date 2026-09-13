import Link from "next/link"
import { ArrowRight, Check, ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"

type Tier = {
  name: string
  price: string
  tagline: string
  features: string[]
  ctaLabel: string
  ctaHref: string
  popular?: boolean
}

const tiers: Tier[] = [
  {
    name: "Hobby",
    price: "$0",
    tagline: "For solo projects and side hustles.",
    features: [
      "10 monitors, 60-second checks",
      "Email + Telegram alerts",
      "1 public status page",
      "7-day incident history",
      "Community support",
    ],
    ctaLabel: "Start free",
    ctaHref: "/sign-up",
  },
  {
    name: "Pro",
    price: "$19",
    tagline: "For serious builders and small teams.",
    features: [
      "100 monitors, 30-second checks",
      "Email, Telegram, Slack, webhooks",
      "3 custom-branded status pages",
      "SDK access — @statuswatch/agent",
      "90-day incident history",
      "Priority email support",
    ],
    ctaLabel: "Start 14-day trial",
    ctaHref: "/sign-up",
    popular: true,
  },
  {
    name: "Team",
    price: "$79",
    tagline: "For teams shipping to production.",
    features: [
      "500 monitors, 15-second checks",
      "All Pro features",
      "10 status pages with custom domain",
      "SSO (Google Workspace, SAML)",
      "Audit log & per-user roles",
      "SLA & Slack Connect support",
    ],
    ctaLabel: "Talk to us",
    ctaHref: "/contact",
  },
]

const faqs: { q: string; a: string }[] = [
  {
    q: "Do you charge per team member?",
    a: "No. All plans include unlimited teammates.",
  },
  {
    q: "Can I switch or cancel any time?",
    a: "Yes, monthly with no penalty.",
  },
  {
    q: "What counts as a “monitor”?",
    a: "Each URL, endpoint, form check, or cron heartbeat = 1 monitor.",
  },
  {
    q: "Do you offer annual discounts?",
    a: "Yes — 2 months free when billed annually.",
  },
]

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12 md:py-16">
      {/* Header */}
      <section className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          Simple, honest pricing
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          Free while you&apos;re small. One team plan when you grow. No
          per-seat surprises.
        </p>
      </section>

      {/* Tier cards */}
      <section className="mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((tier) => {
            const isPopular = !!tier.popular
            return (
              <Card
                key={tier.name}
                className={
                  isPopular
                    ? "p-6 gap-4 relative border-[color:var(--brand-200)] ring-2 ring-[color:var(--brand-500)]/20"
                    : "p-6 gap-4 relative"
                }
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-500)] px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    Popular
                  </div>
                )}
                <div
                  className={
                    isPopular
                      ? "self-start inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-50)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-700)]"
                      : "self-start inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                  }
                >
                  {tier.name}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / month
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{tier.tagline}</p>
                <ul className="mt-2 space-y-2.5">
                  {tier.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--brand-600)]" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.ctaHref}
                  className={
                    isPopular
                      ? "mt-2 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
                      : "mt-2 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold"
                  }
                >
                  {tier.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Not sure yet CTA */}
      <section className="mt-12">
        <Card className="p-6 gap-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px]">
              <h3 className="text-base font-semibold text-foreground">
                Not sure yet?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The Hobby plan is free forever. You can upgrade whenever
                you&apos;re ready.
              </p>
            </div>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            FAQ
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The most common pricing questions.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-foreground">
                <span>{item.q}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
