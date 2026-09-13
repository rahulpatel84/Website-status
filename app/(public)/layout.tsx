import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { currentUser } from "@/lib/auth"

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser()

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar isAuthenticated={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
