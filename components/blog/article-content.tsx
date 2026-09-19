import type { ReactNode } from "react"

type ArticleBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "rule" }

function headingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function extractArticleHeadings(body: string): { id: string; text: string }[] {
  return body
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => {
      const text = line.slice(3).trim()
      return { id: headingId(text), text }
    })
}

function parseArticle(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = []
  const paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") })
      paragraph.length = 0
    }
  }

  function flushList() {
    if (list?.items.length) blocks.push({ type: "list", ...list })
    list = null
  }

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }
    if (line === "---") {
      flushParagraph()
      flushList()
      blocks.push({ type: "rule" })
      continue
    }
    if (line.startsWith("### ") || line.startsWith("## ")) {
      flushParagraph()
      flushList()
      const level = line.startsWith("### ") ? 3 : 2
      blocks.push({ type: "heading", level, text: line.slice(level + 1).trim() })
      continue
    }
    if (line.startsWith("> ")) {
      flushParagraph()
      flushList()
      blocks.push({ type: "quote", text: line.slice(2).trim() })
      continue
    }
    const unordered = line.match(/^[-*]\s+(.+)$/)
    const ordered = line.match(/^\d+[.)]\s+(.+)$/)
    if (unordered || ordered) {
      flushParagraph()
      const isOrdered = Boolean(ordered)
      if (!list || list.ordered !== isOrdered) {
        flushList()
        list = { ordered: isOrdered, items: [] }
      }
      list.items.push((unordered?.[1] ?? ordered?.[1] ?? "").trim())
      continue
    }
    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks
}

export function ArticleContent({ body }: { body: string }) {
  const blocks = parseArticle(body)

  return (
    <div className="text-[17px] leading-8 text-foreground/85">
      {blocks.map((block, index): ReactNode => {
        if (block.type === "heading") {
          const Tag = block.level === 2 ? "h2" : "h3"
          return (
            <Tag
              key={`${block.text}-${index}`}
              id={headingId(block.text)}
              className={
                block.level === 2
                  ? "scroll-mt-24 pt-8 text-2xl font-bold tracking-tight text-foreground first:pt-0"
                  : "scroll-mt-24 pt-5 text-xl font-bold tracking-tight text-foreground"
              }
            >
              {block.text}
            </Tag>
          )
        }
        if (block.type === "paragraph") {
          return <p key={index} className="mt-5">{block.text}</p>
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="my-8 rounded-r-xl border-l-4 border-[color:var(--brand-500)] bg-[color:var(--brand-50)] px-6 py-5 text-lg font-medium leading-8 text-foreground"
            >
              {block.text}
            </blockquote>
          )
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul"
          return (
            <Tag
              key={index}
              className={`my-6 space-y-2 pl-6 marker:font-semibold marker:text-[color:var(--brand-500)] ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
            >
              {block.items.map((item) => <li key={item} className="pl-1">{item}</li>)}
            </Tag>
          )
        }
        return <hr key={index} className="my-10 border-border" />
      })}
    </div>
  )
}

