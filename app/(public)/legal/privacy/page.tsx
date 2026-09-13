export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Privacy policy
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Last updated: 2026-09-05
        </p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              What we collect
            </h2>
            <p>
              status.watch is designed to work without an account. When you
              submit an outage report or comment, we record the service, the
              issue type, and a hashed identifier derived from your IP address
              used only for rate-limiting and abuse prevention. We do not store
              your raw IP address, name, or email unless you provide them
              voluntarily via the contact form.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              How we use it
            </h2>
            <p>
              We use the data you submit to power the public dashboards, detect
              outages, and produce aggregate statistics. Aggregated,
              anonymized data may appear in blog posts or public reports. We
              never sell your data and we never share it with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Retention
            </h2>
            <p>
              Individual reports are retained for 90 days in raw form and then
              aggregated into hourly counts kept indefinitely. Contact-form
              submissions are kept for as long as needed to respond to your
              inquiry.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Your rights
            </h2>
            <p>
              Because we do not store identifying information, we generally
              cannot look up submissions by user. If you would like a comment
              removed, contact us with the approximate time and location and we
              will do our best to help.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
