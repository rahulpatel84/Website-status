import { BlogCmsList } from "@/components/blog/blog-cms-list"
import { requireAuth } from "@/lib/auth"
import { readBlogStore } from "@/lib/blog"

export const dynamic = "force-dynamic"

export default async function BlogCmsPage() {
  const { workspace } = await requireAuth()
  if (workspace.role !== "owner" && workspace.role !== "admin") {
    return (
      <div className="max-w-2xl rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-bold tracking-tight">Blog CMS</h1>
        <p className="mt-2 text-sm text-muted-foreground">Owner or admin access is required to manage public articles.</p>
      </div>
    )
  }
  const store = await readBlogStore()
  const posts = [...store.posts].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return <BlogCmsList initialPosts={posts} categories={store.categories} />
}

