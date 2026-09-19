import { redirect } from "next/navigation"
import {
  currentUser,
  ensureUserAndWorkspace,
  recordClerkSessionIfNew,
} from "@/lib/auth"
import { AppSidebar } from "@/components/app-shell/sidebar"
import { AppTopbar } from "@/components/app-shell/topbar"
import { BackButton } from "@/components/app-shell/back-button"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")
  const workspace = await ensureUserAndWorkspace(user)
  await recordClerkSessionIfNew(user, workspace)

  return (
    <div className="min-h-screen flex flex-col">
      <AppTopbar user={user} workspace={workspace} />
      <div className="flex flex-1">
        <AppSidebar user={user} workspace={workspace} />
        <main className="flex-1 p-4 md:p-8 max-w-full min-w-0">
          <BackButton />
          {children}
        </main>
      </div>
    </div>
  )
}
