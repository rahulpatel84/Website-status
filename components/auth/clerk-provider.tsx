"use client"

// Conditionally wraps children in Clerk's <ClerkProvider> when keys are set.
// When keys are missing we render children directly so the app still works.
//
// Marked `"use client"` so the HAS_CLERK check evaluates in a single
// environment (client, using the build-time-inlined NEXT_PUBLIC_* value).
// Otherwise the server-render could see the env var as unset (e.g. dev
// server started before .env.local existed) while the client bundle has
// it inlined, producing a mismatched tree where <SignIn>/<SignUp> renders
// with no ClerkProvider ancestor.
import type { ReactNode } from "react"
import { ClerkProvider as RealClerkProvider } from "@clerk/nextjs"

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export function ClerkProvider({ children }: { children: ReactNode }) {
  if (!HAS_CLERK) return <>{children}</>
  return <RealClerkProvider>{children}</RealClerkProvider>
}
