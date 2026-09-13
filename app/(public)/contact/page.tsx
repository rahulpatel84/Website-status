"use client"

import { useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [topic, setTopic] = useState("Bug report")
  const [message, setMessage] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Contact us
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          The fastest way to reach the team.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-5">
          <Card className="p-6">
            {submitted ? (
              <div className="py-6 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-600)] font-semibold mb-3">
                  ✓
                </div>
                <h3 className="font-semibold text-lg mb-1">
                  Message sent
                </h3>
                <p className="text-sm text-muted-foreground">
                  Thanks — we&apos;ll get back to you within 2 business days.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setName("")
                    setEmail("")
                    setMessage("")
                    setTopic("Bug report")
                  }}
                  className="mt-4 text-sm text-[color:var(--brand-600)] hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">
                      Your name
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Topic
                  </label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                  >
                    <option>Bug report</option>
                    <option>Request a service</option>
                    <option>Data / API question</option>
                    <option>Press</option>
                    <option>Something else</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Message
                  </label>
                  <textarea
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind…"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Usually respond within 2 business days.
                  </span>
                  <div className="flex-1" />
                  <Button
                    type="submit"
                    className="bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white"
                  >
                    Send message
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <aside className="space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3">Direct channels</h3>
              <div className="space-y-2 text-sm">
                <div className="flex gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
                    General
                  </span>
                  <a
                    href="mailto:hello@status.watch"
                    className="text-[color:var(--brand-600)] hover:underline"
                  >
                    hello@status.watch
                  </a>
                </div>
                <div className="flex gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
                    Press
                  </span>
                  <a
                    href="mailto:press@status.watch"
                    className="text-[color:var(--brand-600)] hover:underline"
                  >
                    press@status.watch
                  </a>
                </div>
                <div className="flex gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
                    Security
                  </span>
                  <a
                    href="mailto:security@status.watch"
                    className="text-[color:var(--brand-600)] hover:underline"
                  >
                    security@status.watch
                  </a>
                </div>
                <div className="flex gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
                    X / Twitter
                  </span>
                  <a
                    href="https://x.com"
                    className="text-[color:var(--brand-600)] hover:underline"
                  >
                    @statuswatch
                  </a>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3">Before you write</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
                <li>
                  Check the{" "}
                  <Link
                    href="/faq"
                    className="text-[color:var(--brand-600)] hover:underline"
                  >
                    FAQ
                  </Link>{" "}
                  — most questions are answered there.
                </li>
                <li>
                  To request a new service, include a URL and category.
                </li>
                <li>
                  To report a security issue, use the security address above.
                </li>
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
