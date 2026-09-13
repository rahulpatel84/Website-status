import { requireAuth } from "@/lib/auth"
import { AssistantChat } from "./chat"

export default async function AssistantPage() {
  await requireAuth()
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY)
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Assistant</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe what you want in plain English — the assistant reasons about it and executes
          against your workspace. Powered by OpenRouter free models.
        </p>
      </div>
      <AssistantChat hasKey={hasKey} />
    </div>
  )
}
