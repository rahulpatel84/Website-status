"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { SignIn } from "@clerk/nextjs"
import { Input } from "@/components/ui/input"

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function ClerkSignIn() {
  return (
    <div className="min-h-[calc(100vh-100px)] grid place-items-center px-4 py-12">
      <SignIn
        afterSignInUrl="/app"
        signUpUrl="/sign-up"
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "w-full max-w-md p-6 md:p-8 rounded-xl border border-border bg-card shadow-none",
          },
        }}
      />
    </div>
  )
}

function DevSignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/dev/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sign-in failed")
        setLoading(false)
        return
      }
      router.push("/app")
    } catch {
      setError("Network error")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-100px)] grid place-items-center px-4 py-12">
      <div className="w-full max-w-md p-6 md:p-8 rounded-xl border border-border bg-card">
        <div className="flex border-b border-border -mx-6 md:-mx-8 px-6 md:px-8 mb-5">
          <Link
            href="/sign-in"
            className="pb-3 pt-1 text-sm font-semibold text-foreground border-b-2 border-foreground -mb-px"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="pb-3 pt-1 ml-5 text-sm text-muted-foreground hover:text-foreground"
          >
            Create account
          </Link>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tight text-foreground m-0">
          Welcome back
        </h1>
        <p className="text-xs text-muted-foreground mt-1.5 mb-5">
          Sign in to continue monitoring your services.
        </p>

        <div className="rounded-md border border-[color:var(--brand-200)] bg-[color:var(--brand-50)] px-3 py-2 text-xs text-[color:var(--brand-700)] mb-4">
          Development mode — add CLERK keys to <code>.env.local</code> to enable
          Google + full auth.
        </div>

        <div className="group relative">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex w-full items-center justify-center gap-2 h-9 px-4 rounded-md border border-border bg-background text-sm font-medium text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-8 whitespace-nowrap rounded-md bg-foreground text-background px-2 py-1 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Available with Clerk keys
          </span>
        </div>

        <div className="flex items-center gap-2.5 my-3.5 text-muted-foreground">
          <div className="flex-1 border-t border-border" />
          <span className="text-[11px]">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="email"
              className="text-[11px] text-muted-foreground block mb-1.5"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label
              htmlFor="name"
              className="text-[11px] text-muted-foreground block mb-1.5"
            >
              Name
            </label>
            <Input
              id="name"
              type="text"
              required
              minLength={1}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          {error ? (
            <p className="text-xs text-[color:var(--status-down)]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold w-full disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground mt-3.5">
          By continuing, you agree to our{" "}
          <Link href="/legal/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline">
            Privacy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  if (HAS_CLERK) return <ClerkSignIn />
  return <DevSignInForm />
}
