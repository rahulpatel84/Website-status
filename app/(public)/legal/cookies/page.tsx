export default function CookiesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Cookie policy
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Last updated: 2026-09-05
        </p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              What are cookies?
            </h2>
            <p>
              Cookies are small text files that a website stores in your
              browser to remember information between visits. We use the
              minimum necessary and never for advertising or cross-site
              tracking.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Cookies we use
            </h2>
            <p>
              status.watch uses a single functional cookie to remember basic
              interface preferences. We do not use analytics cookies, ad
              cookies, or any third-party trackers. Server-sent event
              connections do not use cookies at all.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Third parties
            </h2>
            <p>
              We do not embed third-party comment systems, chat widgets, or
              social share buttons that set cookies. Fonts are self-hosted.
              Optional analytics, when present, are aggregate-only and do not
              set identifying cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Managing cookies
            </h2>
            <p>
              You can clear or block cookies at any time through your browser
              settings. Because status.watch requires no account and stores no
              identifiers, disabling cookies has no impact on core
              functionality.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
