import { Check, Sparkles } from "lucide-react"
import { requireAuth } from "@/lib/auth"

type Tier = {
  id: "hobby" | "pro" | "team"
  name: string
  price: string
  cadence: string
  tagline: string
  features: string[]
  popular?: boolean
}

const TIERS: Tier[] = [
  {
    id: "hobby",
    name: "Hobby",
    price: "$0",
    cadence: "forever",
    tagline: "For solo projects and side hustles.",
    features: [
      "10 monitors, 60-second checks",
      "Email + Telegram alerts",
      "1 public status page",
      "7-day incident history",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    cadence: "per month",
    tagline: "For serious builders and small teams.",
    popular: true,
    features: [
      "100 monitors, 30-second checks",
      "Email, Telegram, Slack, webhooks",
      "3 custom-branded status pages",
      "SDK access — @statuswatch/agent",
      "90-day incident history",
      "Priority email support",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "$79",
    cadence: "per month",
    tagline: "For teams shipping to production.",
    features: [
      "500 monitors, 15-second checks",
      "All Pro features",
      "10 status pages with custom domain",
      "SSO (Google Workspace, SAML)",
      "Audit log & per-user roles",
      "SLA & Slack Connect support",
    ],
  },
]

export default async function PlansPage() {
  const { workspace } = await requireAuth()
  const currentPlan = (workspace.plan || "hobby") as Tier["id"]

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You're currently on the{" "}
          <span className="font-semibold text-foreground">
            {TIERS.find((t) => t.id === currentPlan)?.name ?? "Hobby"}
          </span>{" "}
          plan. Change or upgrade any time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((t) => {
          const isCurrent = t.id === currentPlan
          return (
            <section
              key={t.id}
              className={
                "relative rounded-xl border bg-card p-6 flex flex-col " +
                (t.popular
                  ? "border-[color:var(--brand-500)] shadow-lg"
                  : "border-border")
              }
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-500)] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
                  <Sparkles className="w-3 h-3" /> Most popular
                </div>
              )}

              <div className="mb-1 text-sm font-semibold text-foreground">{t.name}</div>
              <div className="mb-3">
                <span className="text-3xl font-bold text-foreground">{t.price}</span>
                <span className="text-xs text-muted-foreground ml-1.5">{t.cadence}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{t.tagline}</p>

              <ul className="space-y-2 mb-6 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 mt-0.5 text-[color:var(--status-up)] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <PlanCta tierId={t.id} isCurrent={isCurrent} popular={t.popular} />
            </section>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground mt-6 max-w-2xl">
        Billing is coming soon — plans are currently for display only. Contact
        us at{" "}
        <a href="mailto:hello@statuswatch.local" className="underline">
          hello@statuswatch.local
        </a>{" "}
        if you'd like early access to Pro or Team pricing.
      </p>
    </div>
  )
}

function PlanCta({
  tierId,
  isCurrent,
  popular,
}: {
  tierId: Tier["id"]
  isCurrent: boolean
  popular?: boolean
}) {
  if (isCurrent) {
    return (
      <div className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-border bg-muted text-xs font-semibold text-muted-foreground w-full">
        Current plan
      </div>
    )
  }
  const label = tierId === "team" ? "Talk to us" : "Upgrade"
  const href = tierId === "team" ? "/contact" : "mailto:hello@statuswatch.local?subject=Upgrade%20to%20" + tierId
  return (
    <a
      href={href}
      className={
        "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold w-full " +
        (popular
          ? "bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white"
          : "bg-foreground text-background hover:opacity-90")
      }
    >
      {label}
    </a>
  )
}
