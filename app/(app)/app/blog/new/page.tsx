import { BlogEditor } from "@/components/blog/blog-editor"
import { requireAuth } from "@/lib/auth"
import { readBlogStore } from "@/lib/blog"

export const dynamic = "force-dynamic"

export default async function NewBlogArticlePage() {
  const { user, workspace } = await requireAuth()
  if (workspace.role !== "owner" && workspace.role !== "admin") {
    return <p className="text-sm text-muted-foreground">Editor access is required.</p>
  }
  const store = await readBlogStore()
  return <BlogEditor categories={store.categories} authorName={user.name} />
}

