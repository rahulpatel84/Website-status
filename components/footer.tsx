import Link from "next/link"
import { Activity } from "lucide-react"

const COLS = [
  {
    heading: "Product",
    links: [
      { href: "/landing", label: "Overview" },
      { href: "/pricing", label: "Pricing" },
      { href: "/sign-up", label: "Get started" },
      { href: "/services", label: "Outage tracker" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/api-docs", label: "API reference" },
      { href: "/blog", label: "Post-mortems" },
      { href: "/services", label: "Service directory" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/trust", label: "Trust Center" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/cookies", label: "Cookies" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[color:var(--brand-500)]">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-foreground">
                status<span className="text-[color:var(--brand-500)]">.</span>watch
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Real-time outage reports for the internet's most-used services. Free, anonymous, no signup.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X" className="text-muted-foreground hover:text-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub" className="text-muted-foreground hover:text-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.72-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.4-5.25 5.69.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5z" />
                </svg>
              </a>
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs uppercase tracking-wide font-semibold text-foreground mb-3">
                {col.heading}
              </h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} status.watch — Data crowd-sourced from users worldwide.</p>
          <p>Not affiliated with any of the services listed. All trademarks belong to their owners.</p>
        </div>
      </div>
    </footer>
  )
}
