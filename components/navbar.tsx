"use client"

import Link from "next/link"
import { Activity, Menu, X } from "lucide-react"
import { useState } from "react"

const NAV_LINKS = [
  { href: "/landing", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/services", label: "Outage tracker" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/blog", label: "Blog" },
]

export function Navbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[color:var(--brand-500)]">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">
              status<span className="text-[color:var(--brand-500)]">.</span>watch
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground rounded-md transition-colors"
              aria-label="Follow us on X"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {isAuthenticated ? (
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 -mr-2 rounded-md text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden pb-4 flex flex-col gap-1 border-t border-border pt-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
              >
                {l.label}
              </Link>
            ))}
            <div className="flex gap-2 mt-2">
              {isAuthenticated ? (
                <Link
                  href="/app"
                  onClick={() => setOpen(false)}
                  className="flex-1 inline-flex items-center justify-center px-3.5 py-2 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    onClick={() => setOpen(false)}
                    className="flex-1 inline-flex items-center justify-center px-3.5 py-2 rounded-md border border-border text-sm font-semibold"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={() => setOpen(false)}
                    className="flex-1 inline-flex items-center justify-center px-3.5 py-2 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
