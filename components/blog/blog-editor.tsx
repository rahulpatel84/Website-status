"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ArrowLeft, Check, Eye, FileText, Loader2, Save, Sparkles } from "lucide-react"
import { BlogCover } from "@/components/blog/blog-cover"
import { BLOG_ACCENTS, type BlogAccent, type BlogCategory, type BlogPost } from "@/lib/blog-types"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

function toDateTimeLocal(value?: string): string {
  const date = value ? new Date(value) : new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function categoryLabel(categories: BlogCategory[], slug: string): string {
  return categories.find((item) => item.slug === slug)?.name ?? slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
}

const ACCENT_COLORS: Record<BlogAccent, string> = {
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  slate: "bg-slate-600",
}

export function BlogEditor({
  categories,
  post,
  authorName,
}: {
  categories: BlogCategory[]
  post?: BlogPost
  authorName: string
}) {
  const router = useRouter()
  const editing = Boolean(post)
  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(Boolean(post))
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [category, setCategory] = useState(post?.category ?? categories[0]?.slug ?? "product")
  const [author, setAuthor] = useState(post?.author ?? authorName)
  const [authorRole, setAuthorRole] = useState(post?.authorRole ?? "Editorial team")
  const [publishedAt, setPublishedAt] = useState(toDateTimeLocal(post?.publishedAt))
  const [status, setStatus] = useState<"draft" | "published">(post?.status ?? "draft")
  const [featured, setFeatured] = useState(post?.featured ?? false)
  const [accent, setAccent] = useState<BlogAccent>(post?.accent ?? "orange")
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "")
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "")
  const [body, setBody] = useState(post?.body ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wordCount = useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body])
  const readTime = Math.max(1, Math.ceil(wordCount / 220))
  const resolvedCategory = slugify(category) || "product"
  const resolvedCategoryName = categoryLabel(categories, resolvedCategory)

  function changeTitle(value: string) {
    setTitle(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        title,
        slug,
        excerpt,
        category: resolvedCategory,
        categoryName: resolvedCategoryName,
        author,
        authorRole,
        publishedAt: new Date(publishedAt).toISOString(),
        status,
        featured,
        accent,
        seoTitle: seoTitle || title,
        seoDescription: seoDescription || excerpt,
        body,
      }
      const response = await fetch(editing ? `/api/blog/${encodeURIComponent(post!.slug)}` : "/api/blog", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { post?: BlogPost; error?: string }
      if (!response.ok || !result.post) throw new Error(result.error || "Unable to save article")
      router.push("/app/blog")
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save article")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/blog" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Blog CMS
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{editing ? "Edit article" : "Create article"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Compose the story, tune its metadata, then save it as a draft or publish it.</p>
        </div>
        {post?.status === "published" ? (
          <Link href={`/blog/${post.slug}`} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">
            <Eye className="h-4 w-4" /> Preview live article
          </Link>
        ) : null}
      </div>

      <form onSubmit={save} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[color:var(--brand-500)]" />
              <h2 className="font-semibold">Article details</h2>
            </div>
            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="text-xs font-semibold">Title</span>
                <input required maxLength={160} value={title} onChange={(event) => changeTitle(event.target.value)} placeholder="A clear, useful headline" className="mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-base font-medium outline-none focus:border-[color:var(--brand-500)] focus:ring-2 focus:ring-orange-100" />
                <span className="mt-1 block text-right text-[10px] text-muted-foreground">{title.length}/160</span>
              </label>

              <label className="block">
                <span className="text-xs font-semibold">URL slug</span>
                <div className="mt-1.5 flex h-10 items-center rounded-md border border-border bg-background focus-within:border-[color:var(--brand-500)] focus-within:ring-2 focus-within:ring-orange-100">
                  <span className="border-r border-border px-3 text-xs text-muted-foreground">/blog/</span>
                  <input required value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)) }} className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold">Excerpt</span>
                <textarea required maxLength={360} rows={3} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="One or two sentences that earn the click." className="mt-1.5 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--brand-500)] focus:ring-2 focus:ring-orange-100" />
                <span className="mt-1 block text-right text-[10px] text-muted-foreground">{excerpt.length}/360</span>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Article body</h2>
                <p className="mt-1 text-xs text-muted-foreground">Markdown-style headings, lists, quotes, and paragraphs are supported.</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{wordCount} words · {readTime} min</span>
            </div>
            <textarea required value={body} onChange={(event) => setBody(event.target.value)} placeholder={"Open with the main idea…\n\n## Add a section heading\n\nBuild the story with useful detail.\n\n- Lists work too\n\n> Use quotes for important takeaways."} className="mt-5 min-h-[520px] w-full resize-y rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm leading-7 outline-none focus:border-[color:var(--brand-500)] focus:ring-2 focus:ring-orange-100" />
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold">Search metadata</h2>
            <p className="mt-1 text-xs text-muted-foreground">Optional. The headline and excerpt are used when these fields are blank.</p>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold">SEO title</span>
                <input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder={title || "Search result title"} className="mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-[color:var(--brand-500)]" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">SEO description</span>
                <textarea rows={3} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} placeholder={excerpt || "Search result description"} className="mt-1.5 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--brand-500)]" />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <BlogCover accent={accent} category={resolvedCategory} categoryName={resolvedCategoryName} />
            <div className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-600)]">Card preview</div>
              <div className="mt-2 line-clamp-2 text-sm font-bold leading-snug">{title || "Your article title"}</div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{excerpt || "The article excerpt will appear here."}</p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Publishing</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold">Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "published")} className="mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Publish date</span>
                <input type="datetime-local" required value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30">
                <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-500" />
                <span>
                  <span className="block text-xs font-semibold">Featured story</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">Show this article as the journal’s main story.</span>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Organisation</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold">Category</span>
                <input list="blog-category-options" required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="engineering" className="mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-[color:var(--brand-500)]" />
                <datalist id="blog-category-options">
                  {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
                </datalist>
                <span className="mt-1 block text-[10px] text-muted-foreground">Choose one or type a new category.</span>
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Author</span>
                <input required value={author} onChange={(event) => setAuthor(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-[color:var(--brand-500)]" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Author role</span>
                <input value={authorRole} onChange={(event) => setAuthorRole(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-[color:var(--brand-500)]" />
              </label>
              <fieldset>
                <legend className="text-xs font-semibold">Cover accent</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BLOG_ACCENTS.map((item) => (
                    <button key={item} type="button" onClick={() => setAccent(item)} className={`relative h-8 w-8 rounded-full ${ACCENT_COLORS[item]} ring-offset-2 transition-transform hover:scale-105 ${accent === item ? "ring-2 ring-foreground" : ""}`} aria-label={`${item} accent`} aria-pressed={accent === item}>
                      {accent === item ? <Check className="absolute inset-0 m-auto h-4 w-4 text-white" /> : null}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

          <button type="submit" disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--brand-500)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--brand-600)] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "published" ? <Sparkles className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : status === "published" ? "Save and publish" : "Save draft"}
          </button>
        </aside>
      </form>
    </div>
  )
}

