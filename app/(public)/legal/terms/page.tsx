export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Terms of service
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Last updated: 2026-09-05
        </p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Acceptance
            </h2>
            <p>
              By accessing status.watch you agree to these terms. If you do not
              agree, please do not use the site. We may update these terms from
              time to time; continued use after changes constitutes acceptance
              of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Acceptable use
            </h2>
            <p>
              You may use status.watch for personal, journalistic, or
              professional purposes. Do not submit false reports, spam
              comments, scrape aggressively, or attempt to disrupt the
              service. Automated read access is welcome within the published
              rate limits.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Content
            </h2>
            <p>
              Reports and comments you submit are public and may be republished
              in aggregate. You retain no ownership over anonymous, aggregated
              statistics derived from your submissions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Disclaimer
            </h2>
            <p>
              status.watch is provided as-is with no warranties. Status data
              is best-effort and should not be relied on for safety-critical
              decisions. We are not affiliated with the services we monitor
              and all trademarks belong to their respective owners.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
