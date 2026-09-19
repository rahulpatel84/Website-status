import { Card } from "@/components/ui/card"

const steps = [
  {
    badge: "01 · Detect",
    aside: "You + probes",
    title: "Reports come in",
    body: "When you tap “I have a problem,” we record the service, issue type (login, feed, payments, etc.), an anonymized IP-hashed identifier for rate limiting, and the coarse city we look up from your IP. Meanwhile, our own HTTP probes ping each service every 60 seconds.",
  },
  {
    badge: "02 · Aggregate",
    aside: "Baseline vs. now",
    title: "Compare to a rolling baseline",
    body: "Every service has a rolling 30-day baseline for report volume by hour and day-of-week. When live reports exceed the baseline by more than 3x for 5 consecutive minutes, we flip status to degraded. Above 5x for 10 minutes we flip to down and open an incident.",
  },
  {
    badge: "03 · Visualize",
    aside: "Charts + heatmap",
    title: "Show the picture",
    body: "Every service page shows a 24-hour report chart with baseline overlay, a live geographic heatmap, the top 3 problem categories, and the most-affected cities. Comments stream in via server-sent events.",
  },
  {
    badge: "04 · Notify",
    aside: "Email · RSS · webhook",
    title: "Reach the right people",
    body: "Subscribe to any service and get a heads-up the moment reports spike — before the vendor’s status page catches up. Subscriptions are anonymous email or programmatic (RSS, webhook).",
  },
]

const safeguards = [
  "Rate limit: 3 reports/min and 30 reports/day per hashed IP.",
  "Comment bad-words filter + community flagging (auto-hide at 5 flags).",
  "Bot filter on user agents; suspicious traffic weighted at 0.",
  "Reports outside the affected region are down-weighted in the baseline algorithm.",
]

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="mx-auto max-w-[800px]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          How status.watch works
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Four steps from your click to a live incident.
        </p>

        <div className="space-y-4">
          {steps.map((s) => (
            <Card key={s.badge} className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[color:var(--brand-50)] text-[color:var(--brand-700)]">
                  {s.badge}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {s.aside}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-1.5">{s.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{s.body}</p>
            </Card>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-3">
            Data quality safeguards
          </h2>
          <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc pl-5">
            {safeguards.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
