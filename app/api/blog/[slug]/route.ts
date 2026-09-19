import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import {
  createBlogPostFromInput,
  ensureBlogCategory,
  findBlogPost,
  updateBlogStore,
} from "@/lib/blog"
import type { BlogPost, BlogPostInput } from "@/lib/blog-types"

async function authorizeEditor() {
  const user = await currentUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) }
  const workspace = await ensureUserAndWorkspace(user)
  if (workspace.role !== "owner" && workspace.role !== "admin") {
    return { error: NextResponse.json({ error: "Editor access is required" }, { status: 403 }) }
  }
  return { user }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeEditor()
  if ("error" in auth) return auth.error

  let input: BlogPostInput
  try {
    input = (await request.json()) as BlogPostInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  let updated: BlogPost | undefined
  try {
    await updateBlogStore((store) => {
      const existing = findBlogPost(store, params.slug)
      if (!existing) throw new Error("Article not found")
      const post = createBlogPostFromInput(input, {
        existing,
        fallbackAuthor: auth.user.name,
      })
      if (post.slug !== params.slug && store.posts.some((item) => item.slug === post.slug)) {
        throw new Error("An article with this slug already exists")
      }
      ensureBlogCategory(store, post.category, input.categoryName)
      if (post.featured) {
        store.posts = store.posts.map((item) => ({ ...item, featured: false }))
      }
      const index = store.posts.findIndex((item) => item.slug === params.slug)
      store.posts[index] = post
      updated = post
    })
    return NextResponse.json({ post: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update article"
    const status = message === "Article not found" ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeEditor()
  if ("error" in auth) return auth.error

  try {
    await updateBlogStore((store) => {
      const index = store.posts.findIndex((post) => post.slug === params.slug)
      if (index === -1) throw new Error("Article not found")
      store.posts.splice(index, 1)
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete article"
    return NextResponse.json({ error: message }, { status: message === "Article not found" ? 404 : 400 })
  }
}

