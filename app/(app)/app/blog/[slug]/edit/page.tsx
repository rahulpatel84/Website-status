import { notFound } from "next/navigation"
import { BlogEditor } from "@/components/blog/blog-editor"
import { requireAuth } from "@/lib/auth"
import { findBlogPost, readBlogStore } from "@/lib/blog"

export const dynamic = "force-dynamic"

export default async function EditBlogArticlePage({ params }: { params: { slug: string } }) {
  const { user, workspace } = await requireAuth()
  if (workspace.role !== "owner" && workspace.role !== "admin") {
    return <p className="text-sm text-muted-foreground">Editor access is required.</p>
  }
  const store = await readBlogStore()
  const post = findBlogPost(store, params.slug)
  if (!post) notFound()
  return <BlogEditor categories={store.categories} authorName={user.name} post={post} />
}

