"use client"

import { UserProfile } from "@clerk/nextjs"

// Only rendered by settings/page.tsx when HAS_CLERK is true on the server,
// so it's safe to import statically — the ClerkProvider at the app root
// gives this the context it needs.
export function ClerkProfileEmbed() {
  return (
    <div className="clerk-profile-embed">
      <UserProfile routing="hash" />
    </div>
  )
}
