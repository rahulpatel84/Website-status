"use client"

import { LogOut } from "lucide-react"
import { useClerk } from "@clerk/nextjs"

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

/**
 * Sign-out button that works for both Clerk and dev-cookie auth modes.
 * Two visual variants:
 *   - "sidebar" — full-width row, matches the profile block above it.
 *   - "chip"    — compact button, for settings-page header etc.
 */
export function SignOutButton({
  variant = "chip",
}: {
  variant?: "sidebar" | "chip"
}) {
  return HAS_CLERK ? (
    <ClerkAwareSignOut variant={variant} />
  ) : (
    <DevSignOut variant={variant} />
  )
}

function ClerkAwareSignOut({ variant }: { variant: "sidebar" | "chip" }) {
  const clerk = useClerk()
  async function signOut() {
    try {
      await clerk.signOut({ redirectUrl: "/" })
      await fetch("/api/auth/dev/signout", { method: "POST" }).catch(() => {})
    } finally {
      window.location.href = "/"
    }
  }
  return <SignOutView variant={variant} onClick={signOut} />
}

function DevSignOut({ variant }: { variant: "sidebar" | "chip" }) {
  async function signOut() {
    await fetch("/api/auth/dev/signout", { method: "POST" }).catch(() => {})
    window.location.href = "/"
  }
  return <SignOutView variant={variant} onClick={signOut} />
}

function SignOutView({
  variant,
  onClick,
}: {
  variant: "sidebar" | "chip"
  onClick: () => void
}) {
  if (variant === "sidebar") {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sign out
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-input text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <LogOut className="w-3.5 h-3.5" /> Sign out
    </button>
  )
}
