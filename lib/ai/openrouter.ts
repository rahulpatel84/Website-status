// Thin wrapper around the OpenRouter chat-completions endpoint.
// Uses free-tier models by default with a fallback chain — free endpoints on
// OpenRouter get rotated/retired often, so we walk the list until one succeeds.

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

// Order: bigger + newer first, small fast ones last. First one that responds
// wins for this request.
const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "mistralai/mistral-nemo:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-2-9b-it:free",
  "deepseek/deepseek-chat:free",
]

export interface OpenRouterOpts {
  model?: string
  temperature?: number
  responseAsJson?: boolean
}

export interface OpenRouterResult {
  ok: boolean
  text: string
  model?: string
  error?: string
  attempts?: { model: string; status: number; error?: string }[]
  raw?: any
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: OpenRouterOpts = {},
): Promise<OpenRouterResult> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) {
    return {
      ok: false,
      text:
        "The AI assistant is not configured yet. Add OPENROUTER_API_KEY to your .env.local — you can get a free key at https://openrouter.ai/keys — then restart the dev server.",
      error: "no-api-key",
    }
  }

  // If caller pinned a model, honour it. Else walk the fallback chain.
  const tryList = opts.model
    ? [opts.model]
    : (process.env.OPENROUTER_MODEL ? [process.env.OPENROUTER_MODEL] : []).concat(FREE_MODELS)

  const attempts: { model: string; status: number; error?: string }[] = []

  for (const model of tryList) {
    const body: any = {
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
    }
    if (opts.responseAsJson) {
      body.response_format = { type: "json_object" }
    }

    let r: Response
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "status.watch",
        },
        body: JSON.stringify(body),
      })
    } catch (e: any) {
      attempts.push({ model, status: 0, error: e?.message ?? "network-error" })
      continue
    }

    const j = await r.json().catch(() => ({}))

    if (r.ok) {
      const text = j.choices?.[0]?.message?.content ?? ""
      return { ok: true, text: String(text), model: j.model ?? model, attempts, raw: j }
    }

    attempts.push({
      model,
      status: r.status,
      error: j?.error?.message ?? JSON.stringify(j).slice(0, 200),
    })

    // Fallible on model-not-found / not-available / bad-request / rate-limit — try the next model.
    // Give up on auth errors (401/403) since retrying won't help.
    if (r.status === 401 || r.status === 403) break
  }

  const detail = attempts
    .map((a) => `${a.model}: ${a.status || "network"} ${a.error ?? ""}`.trim())
    .join(" · ")
  return {
    ok: false,
    text:
      "All free OpenRouter models failed to respond. Attempts:\n" +
      detail +
      "\n\nTip: set OPENROUTER_MODEL in .env.local to a specific model slug you know is available (e.g. meta-llama/llama-3.3-70b-instruct:free).",
    error: "all-models-failed",
    attempts,
  }
}

export { FREE_MODELS }
