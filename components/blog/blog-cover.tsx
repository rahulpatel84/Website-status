import {
  Activity,
  BarChart3,
  BookOpen,
  Code2,
  Database,
  MessageSquareText,
  Radio,
} from "lucide-react"
import type { BlogAccent } from "@/lib/blog-types"

const THEMES: Record<
  BlogAccent,
  { background: string; glow: string; line: string; ink: string }
> = {
  orange: {
    background: "from-orange-100 via-orange-50 to-white",
    glow: "bg-orange-300/40",
    line: "bg-orange-500",
    ink: "text-orange-700",
  },
  amber: {
    background: "from-amber-100 via-amber-50 to-white",
    glow: "bg-amber-300/40",
    line: "bg-amber-500",
    ink: "text-amber-700",
  },
  emerald: {
    background: "from-emerald-100 via-emerald-50 to-white",
    glow: "bg-emerald-300/40",
    line: "bg-emerald-500",
    ink: "text-emerald-700",
  },
  blue: {
    background: "from-sky-100 via-sky-50 to-white",
    glow: "bg-sky-300/40",
    line: "bg-sky-500",
    ink: "text-sky-700",
  },
  violet: {
    background: "from-violet-100 via-violet-50 to-white",
    glow: "bg-violet-300/40",
    line: "bg-violet-500",
    ink: "text-violet-700",
  },
  slate: {
    background: "from-slate-200 via-slate-100 to-white",
    glow: "bg-slate-400/30",
    line: "bg-slate-600",
    ink: "text-slate-700",
  },
}

const ICONS = {
  "post-mortems": Activity,
  engineering: Code2,
  data: BarChart3,
  guides: BookOpen,
  product: MessageSquareText,
} as const

export function BlogCover({
  accent,
  category,
  categoryName,
  large = false,
}: {
  accent: BlogAccent
  category: string
  categoryName: string
  large?: boolean
}) {
  const theme = THEMES[accent]
  const Icon = ICONS[category as keyof typeof ICONS] ?? Radio

  return (
    <div
      aria-hidden="true"
      className={`relative isolate overflow-hidden bg-gradient-to-br ${theme.background} ${
        large ? "min-h-[300px] sm:min-h-[390px]" : "aspect-[16/10]"
      }`}
    >
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className={`absolute -right-12 -top-16 h-52 w-52 rounded-full blur-3xl ${theme.glow}`} />
      <div className={`absolute -bottom-20 -left-12 h-56 w-56 rounded-full blur-3xl ${theme.glow}`} />

      <div className="absolute inset-0 flex items-center justify-center p-7 sm:p-10">
        <div className={`w-full rounded-2xl border border-white/80 bg-white/78 p-4 shadow-xl shadow-black/5 backdrop-blur-sm ${large ? "max-w-lg sm:p-6" : "max-w-xs"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={`grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm ${theme.ink}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Field note
                </div>
                <div className={`text-xs font-semibold ${theme.ink}`}>{categoryName}</div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${theme.line}`} /> Live data
            </span>
          </div>

          <div className={`mt-5 grid items-end gap-1 ${large ? "h-32 grid-cols-12" : "h-20 grid-cols-10"}`}>
            {[38, 52, 43, 66, 48, 78, 58, 88, 72, 94, 70, 82].slice(0, large ? 12 : 10).map((height, index) => (
              <div key={index} className="relative h-full rounded-sm bg-slate-100/90">
                <div
                  className={`absolute inset-x-0 bottom-0 rounded-sm ${theme.line}`}
                  style={{ height: `${height}%`, opacity: index % 3 === 0 ? 1 : 0.64 }}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-400">
            <span>status.watch research</span>
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3" /> Verified signal
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
