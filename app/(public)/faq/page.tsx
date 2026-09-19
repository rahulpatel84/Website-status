import Link from "next/link"
import { Card } from "@/components/ui/card"

type QA = { q: string; a: React.ReactNode }

const faqs: QA[] = [
  {
    q: "Is status.watch free?",
    a: "Yes. Every feature on the site is free and there's no signup. Enterprise API tiers may launch later — the public API stays free.",
  },
  {
    q: "Do you have an account or login?",
    a: "No. Reports and comments are anonymous. We hash your IP to prevent abuse, but we never store your identity.",
  },
  {
    q: "Where does the report data come from?",
    a: (
      <>
        User reports, our own uptime probes, vendor status feeds, and public X
        search — see{" "}
        <Link
          href="/how-it-works"
          className="text-[color:var(--brand-600)] hover:underline"
        >
          How it works
        </Link>
        .
      </>
    ),
  },
  {
    q: "How accurate is it?",
    a: "We compare live reports against a rolling 30-day baseline. Small services can have false positives; large ones (Instagram, Google) rarely do.",
  },
  {
    q: "Why is my service marked as down when it works for me?",
    a: "Outages are often regional. Check the heatmap on the service page — the issue may be affecting other countries or cities.",
  },
  {
    q: "Can I subscribe to alerts?",
    a: 'Yes — email, RSS, or webhook. Look for the "Subscribe" button on any service page.',
  },
  {
    q: "Do you have an API?",
    a: (
      <>
        Yes, public and free — see the{" "}
        <Link
          href="/api-docs"
          className="text-[color:var(--brand-600)] hover:underline"
        >
          API docs
        </Link>
        . No key required for read endpoints.
      </>
    ),
  },
  {
    q: "How do you moderate comments?",
    a: "Automated bad-word filter, rate limits, and community flagging. Comments flagged 5+ times auto-hide pending review.",
  },
  {
    q: "Can I request a new service to monitor?",
    a: (
      <>
        Yes —{" "}
        <Link
          href="/contact"
          className="text-[color:var(--brand-600)] hover:underline"
        >
          contact us
        </Link>
        . Popular requests get added within a week.
      </>
    ),
  },
  {
    q: "Do you sell or share my data?",
    a: "No. We don't sell data. Aggregated, anonymized statistics may appear in blog posts.",
  },
  {
    q: "Do you use cookies?",
    a: "One functional cookie for your theme preference. No analytics or ad cookies.",
  },
  {
    q: "Are you affiliated with these services?",
    a: "No. Every trademark belongs to its owner. We're independent.",
  },
  {
    q: "Can I embed a status widget on my site?",
    a: "Coming soon. A small iframe with live status for any service you monitor.",
  },
  {
    q: "How do I remove a report I posted?",
    a: "Flag the comment or contact us with the approximate time and location.",
  },
  {
    q: "Something looks wrong — how do I report it?",
    a: (
      <>
        Email{" "}
        <a
          href="mailto:hello@status.watch"
          className="text-[color:var(--brand-600)] hover:underline"
        >
          hello@status.watch
        </a>{" "}
        or reach out via our{" "}
        <Link
          href="/contact"
          className="text-[color:var(--brand-600)] hover:underline"
        >
          contact page
        </Link>
        .
      </>
    ),
  },
]

export default function FAQPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Frequently asked questions
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Fifteen answers to the questions we hear most.
        </p>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <Card key={i} className="p-0 gap-0">
              <details className="group">
                <summary className="cursor-pointer list-none px-6 py-4 font-semibold flex items-center justify-between">
                  <span>{f.q}</span>
                  <span className="text-muted-foreground text-lg transition-transform group-open:rotate-45 select-none">
                    +
                  </span>
                </summary>
                <div className="px-6 pb-5 text-muted-foreground leading-relaxed">
                  {f.a}
                </div>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
