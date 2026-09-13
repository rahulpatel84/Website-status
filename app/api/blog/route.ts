import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import {
  createBlogPostFromInput,
  ensureBlogCategory,
  readBlogStore,
  updateBlogStore,
} from "@/lib/blog"
import type { BlogPostInput } from "@/lib/blog-types"

async function authorizeEditor() {
  const user = await currentUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) }
  const workspace = await ensureUserAndWorkspace(user)
  if (workspace.role !== "owner" && workspace.role !== "admin") {
    return { error: NextResponse.json({ error: "Editor access is required" }, { status: 403 }) }
  }
  return { user }
}

export async function GET() {
  const auth = await authorizeEditor()
  if ("error" in auth) return auth.error
  return NextResponse.json(await readBlogStore())
}

export async function POST(request: Request) {
  const auth = await authorizeEditor()
  if ("error" in auth) return auth.error

  let input: BlogPostInput
  try {
    input = (await request.json()) as BlogPostInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const next = await updateBlogStore((store) => {
      const post = createBlogPostFromInput(input, { fallbackAuthor: auth.user.name })
      if (store.posts.some((item) => item.slug === post.slug)) {
        throw new Error("An article with this slug already exists")
      }
      ensureBlogCategory(store, post.category, input.categoryName)
      if (post.featured) {
        store.posts = store.posts.map((item) => ({ ...item, featured: false }))
      }
      store.posts.unshift(post)
    })
    const created = next.posts.find((post) => post.slug === next.posts[0]?.slug)
    return NextResponse.json({ post: created }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create article"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

