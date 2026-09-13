import type { Metadata } from "next"
import { BlogIndex } from "@/components/blog/blog-index"
import { publishedBlogPosts, readBlogStore } from "@/lib/blog"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Blog | status.watch",
  description:
    "Monitoring guides, incident post-mortems, engineering notes, and outage data from status.watch.",
  openGraph: {
    title: "The status.watch journal",
    description:
      "Practical lessons for teams that build and operate reliable internet services.",
    type: "website",
  },
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams?: { q?: string; category?: string }
}) {
  const store = await readBlogStore()
  const posts = publishedBlogPosts(store)

  return (
    <BlogIndex
      posts={posts}
      categories={store.categories}
      initialQuery={searchParams?.q ?? ""}
      initialCategory={searchParams?.category ?? "all"}
    />
  )
}
