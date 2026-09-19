import { NextResponse, type NextRequest } from "next/server"

const HAS_CLERK = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
)

const PROTECTED_PREFIXES = ["/app"]

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

async function clerkMiddleware(req: NextRequest) {
  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server")
  const isProtectedRoute = createRouteMatcher(["/app(.*)"])
  return clerkMiddleware(async (auth, request) => {
    if (isProtectedRoute(request)) {
      const { userId, redirectToSignIn } = await auth()
      if (!userId) return redirectToSignIn({ returnBackUrl: request.url })
    }
  })(req, {} as any)
}

function devMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!isProtected(pathname)) return NextResponse.next()
  const uid = req.cookies.get("sw_dev_uid")?.value
  if (uid) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = "/sign-in"
  url.searchParams.set("next", pathname)
  return NextResponse.redirect(url)
}

export default async function middleware(req: NextRequest) {
  return HAS_CLERK ? clerkMiddleware(req) : devMiddleware(req)
}

export const config = {
  matcher: [
    // Skip static files & _next
    "/((?!_next|.*\\..*).*)",
  ],
}
