import Link from "next/link"
import { Card } from "@/components/ui/card"

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          About status.watch
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          We help people find out — in seconds — whether the internet service
          they need is actually broken, or whether it&apos;s just them.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-semibold mb-3">Our mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              When Instagram is down, you don&apos;t want to spend ten minutes
              checking your Wi-Fi, restarting your router, and blaming your
              phone. status.watch aggregates real-time reports from real users
              worldwide so you can confirm the outage in one glance and move on
              with your day.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How we&apos;re different</h2>
            <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc pl-5">
              <li>
                <span className="text-foreground font-medium">Free and anonymous.</span>{" "}
                No account, no tracking, no ads.
              </li>
              <li>
                <span className="text-foreground font-medium">Fully open data.</span>{" "}
                Our reports API is public.
              </li>
              <li>
                <span className="text-foreground font-medium">Live community.</span>{" "}
                Comments, upvotes, and geo-tagged reports show what&apos;s
                actually happening.
              </li>
              <li>
                <span className="text-foreground font-medium">Vendor-neutral.</span>{" "}
                We&apos;re not affiliated with any of the services we monitor.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              Where our data comes from
            </h2>
            <ol className="space-y-2 text-muted-foreground leading-relaxed list-decimal pl-5">
              <li>
                <span className="text-foreground font-medium">User reports</span>{" "}
                — anyone can report an issue in one click.
              </li>
              <li>
                <span className="text-foreground font-medium">Uptime probes</span>{" "}
                — periodic HTTP checks against each service.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Vendor status pages
                </span>{" "}
                — we ingest official incident feeds where available.
              </li>
              <li>
                <span className="text-foreground font-medium">Social signals</span>{" "}
                — mention volume on X, indexed via public search.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">The team</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5">
                <div className="flex items-center justify-center h-11 w-11 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-600)] font-semibold">
                  R
                </div>
                <div className="mt-3 font-semibold">Rahul</div>
                <div className="text-xs text-muted-foreground">
                  Founder · engineering
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-center h-11 w-11 rounded-full bg-muted text-muted-foreground font-semibold">
                  ·
                </div>
                <div className="mt-3 font-semibold">Hiring</div>
                <div className="text-xs text-muted-foreground">
                  Frontend engineer
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-center h-11 w-11 rounded-full bg-muted text-muted-foreground font-semibold">
                  ·
                </div>
                <div className="mt-3 font-semibold">Hiring</div>
                <div className="text-xs text-muted-foreground">Data / SRE</div>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact &amp; press</h2>
            <p className="text-muted-foreground leading-relaxed">
              General:{" "}
              <a
                className="text-[color:var(--brand-600)] hover:underline"
                href="mailto:hello@status.watch"
              >
                hello@status.watch
              </a>{" "}
              · Press:{" "}
              <a
                className="text-[color:var(--brand-600)] hover:underline"
                href="mailto:press@status.watch"
              >
                press@status.watch
              </a>{" "}
              · See the{" "}
              <Link
                className="text-[color:var(--brand-600)] hover:underline"
                href="/contact"
              >
                contact page
              </Link>{" "}
              for more.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
