import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Radio, UserRound } from "lucide-react"
import { ArticleContent, extractArticleHeadings } from "@/components/blog/article-content"
import { BlogCover } from "@/components/blog/blog-cover"
import {
  findBlogCategory,
  findBlogPost,
  formatBlogDate,
  publishedBlogPosts,
  readBlogStore,
} from "@/lib/blog"

export const dynamic = "force-dynamic"

interface ArticlePageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const store = await readBlogStore()
  const post = findBlogPost(store, params.slug)
  if (!post || post.status !== "published") return { title: "Article not found | status.watch" }

  return {
    title: `${post.seoTitle || post.title} | status.watch`,
    description: post.seoDescription || post.excerpt,
    authors: [{ name: post.author }],
    openGraph: {
      type: "article",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
    },
  }
}

export default async function BlogArticlePage({ params }: ArticlePageProps) {
  const store = await readBlogStore()
  const post = findBlogPost(store, params.slug)
  if (!post || post.status !== "published" || new Date(post.publishedAt).getTime() > Date.now()) {
    notFound()
  }

  const category = findBlogCategory(store, post.category)
  const headings = extractArticleHeadings(post.body)
  const allPublished = publishedBlogPosts(store)
  const related = [
    ...allPublished.filter((item) => item.slug !== post.slug && item.category === post.category),
    ...allPublished.filter((item) => item.slug !== post.slug && item.category !== post.category),
  ].slice(0, 3)

  const initials = post.author
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Person", name: post.author },
    publisher: { "@type": "Organization", name: "status.watch" },
  }

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="border-b border-border bg-gradient-to-b from-[color:var(--brand-50)]/70 to-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 md:py-20">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the journal
          </Link>

          <div className="mt-10 max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link
                href={`/blog?category=${category.slug}`}
                className="rounded-full border border-[color:var(--brand-200)] bg-white px-3 py-1 font-semibold text-[color:var(--brand-700)]"
              >
                {category.name}
              </Link>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock3 className="h-4 w-4" /> {post.readTime} min read
              </span>
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-foreground sm:text-5xl md:text-6xl">
              {post.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
              {post.excerpt}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-foreground text-sm font-bold text-background">
                {initials}
              </span>
              <div>
                <div className="text-sm font-semibold">{post.author}</div>
                <div className="text-xs text-muted-foreground">{post.authorRole}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <div className="overflow-hidden rounded-3xl border border-border shadow-sm">
          <BlogCover accent={post.accent} category={post.category} categoryName={category.name} large />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,720px)_260px] lg:justify-between">
          <article>
            <ArticleContent body={post.body} />

            <div className="mt-12 flex items-center gap-4 rounded-2xl border border-border bg-muted/30 p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-foreground text-sm font-bold text-background">
                {initials}
              </span>
              <div>
                <div className="text-sm font-bold">Written by {post.author}</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {post.authorRole} at status.watch, writing about monitoring, incident response, and dependable products.
                </p>
              </div>
            </div>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {headings.length ? (
                <nav className="rounded-xl border border-border bg-card p-5" aria-label="Table of contents">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    In this article
                  </div>
                  <div className="mt-4 space-y-3">
                    {headings.map((heading) => (
                      <a key={heading.id} href={`#${heading.id}`} className="block text-sm leading-5 text-muted-foreground transition-colors hover:text-[color:var(--brand-600)]">
                        {heading.text}
                      </a>
                    ))}
                  </div>
                </nav>
              ) : null}

              <div className="rounded-xl bg-foreground p-5 text-background">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--brand-500)]">
                  <Radio className="h-4 w-4 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-bold">Know before users do.</h2>
                <p className="mt-2 text-sm leading-6 text-background/65">
                  Monitor critical journeys from multiple regions in minutes.
                </p>
                <Link href="/sign-up" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-orange-400 hover:text-orange-300">
                  Start monitoring <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {related.length ? (
          <section className="mt-20 border-t border-border pt-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-600)]">Keep reading</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Related stories</h2>
              </div>
              <Link href="/blog" className="hidden items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline-flex">
                All articles <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {related.map((item) => {
                const itemCategory = findBlogCategory(store, item.category)
                return (
                  <Link key={item.slug} href={`/blog/${item.slug}`} className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-200)] hover:shadow-lg">
                    <div className="text-xs font-semibold text-[color:var(--brand-700)]">{itemCategory.name}</div>
                    <h3 className="mt-3 font-bold leading-snug group-hover:text-[color:var(--brand-600)]">{item.title}</h3>
                    <div className="mt-5 flex items-center gap-1 text-xs text-muted-foreground">
                      <UserRound className="h-3.5 w-3.5" /> {item.author} · {item.readTime} min
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
