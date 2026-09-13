# Worker Fleet · Manager Dashboard

A live dashboard for running many Claude Agent SDK workers in parallel and watching what each one is doing in real time.

## What it does

- You drop N task prompts into the dashboard.
- The server spawns N Claude workers concurrently via `@anthropic-ai/claude-agent-sdk`.
- Each worker streams its assistant text, tool calls, tool results, and final result over a WebSocket to a live card in the UI.
- You (the manager) see every worker's activity at a glance.

## Setup

```bash
cd manager-workers
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # required
npm start
```

Then open http://localhost:3737 .

## Using it

1. Type one task per line in the textarea (each line = one worker).
2. Optionally set a **working directory** so workers can read/edit files there.
3. Pick a **permission mode** — `bypassPermissions` runs autonomously; `default` will stall on writes since there's no interactive TTY.
4. Click **Dispatch workers**.
5. Watch cards populate live. Each card shows worker id, running/completed/error status, per-event stream (tool calls in yellow, assistant text in blue, results in grey, final summary in green with cost & turn count).

## API

- `POST /dispatch` — `{ tasks: string[], cwd?, permissionMode?, model?, allowedTools? }` → `{ ids }`
- `POST /clear` — remove completed/errored workers from view
- `GET  /workers` — list all
- `GET  /workers/:id` — one worker with full event log
- `WS   /` — live stream of `worker:start`, `worker:event`, `worker:done`, `cleared`

## Files

- `server.mjs` — Express + WebSocket + SDK orchestrator
- `public/index.html` — single-file dashboard (vanilla JS)

## Notes

- The SDK requires `ANTHROPIC_API_KEY` in the environment.
- `bypassPermissions` is the right mode for autonomous fan-out. Workers with `default` will hang on file writes because there's no interactive terminal to approve.
- Workers inherit the server's CWD unless you pass `cwd` per dispatch.
- Cost & turn counts appear in the final `done` event.
