import express from "express";
import { WebSocketServer } from "ws";
import { query, createSdkMcpServer, tool, listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Persistence ----------

const DATA_DIR = path.join(__dirname, "data", "workers");
fs.mkdirSync(DATA_DIR, { recursive: true });

const saveTimers = new Map();
function scheduleSave(w) {
  const t = saveTimers.get(w.id);
  if (t) clearTimeout(t);
  saveTimers.set(w.id, setTimeout(() => {
    saveWorkerNow(w);
    saveTimers.delete(w.id);
  }, 400));
}

function saveWorkerNow(w) {
  const file = path.join(DATA_DIR, `${w.id}.json`);
  const serializable = { ...w, isSession: false }; // never persist live-session flag
  fs.writeFile(file, JSON.stringify(serializable), (err) => {
    if (err) console.error(`[persist] failed to save ${w.id}:`, err.message);
  });
}

function loadAllWorkersFromDisk() {
  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    let loaded = 0;
    for (const f of files) {
      try {
        const w = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
        // Any workers that were mid-flight when we shut down can't be resumed — the async iterable is gone.
        if (w.status === "running" || w.status === "idle") {
          w.status = "error";
          w.error = "Server restarted while this session was active. History is preserved; the session can't be resumed. Start a new manager conversation.";
          w.finishedAt = w.finishedAt || Date.now();
        }
        w.isSession = false;
        workers.set(w.id, w);
        loaded++;
      } catch (e) {
        console.error(`[persist] skipping ${f}:`, e.message);
      }
    }
    if (loaded) console.log(`[persist] loaded ${loaded} historical worker record(s) from disk`);
  } catch (e) {
    console.error("[persist] load error:", e.message);
  }
}

function deleteWorkerFile(id) {
  const file = path.join(DATA_DIR, `${id}.json`);
  fs.unlink(file, () => {});
}

const app = express();
app.use(express.json({ limit: "30mb" })); // large limit so images can be inlined as base64
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** @type {Map<string, any>} */
const workers = new Map();
/** @type {Map<string, {queue: any[], resolvers: Function[], closed: boolean}>} */
const sessions = new Map();
const clients = new Set();

function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients) {
    if (c.readyState === 1) c.send(s);
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(
    JSON.stringify({
      type: "snapshot",
      workers: Array.from(workers.values()),
    })
  );
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

function summarizeEvent(msg) {
  const out = { type: msg.type, ts: Date.now() };
  if (msg.type === "assistant" && msg.message?.content) {
    for (const c of msg.message.content) {
      if (c.type === "text") {
        out.kind = "text";
        out.text = c.text;
      } else if (c.type === "tool_use") {
        out.kind = "tool_use";
        out.tool = c.name;
        out.input = c.input;
      } else if (c.type === "thinking") {
        out.kind = "thinking";
        out.text = c.thinking;
      }
    }
  } else if (msg.type === "user" && msg.message?.content) {
    for (const c of msg.message.content) {
      if (c.type === "tool_result") {
        out.kind = "tool_result";
        const content = typeof c.content === "string"
          ? c.content
          : Array.isArray(c.content)
            ? c.content.map((x) => x.text || "").join("")
            : JSON.stringify(c.content);
        out.text = content.slice(0, 2000);
        out.is_error = c.is_error || false;
      }
    }
  } else if (msg.type === "result") {
    out.kind = "result";
    out.text = msg.result || "";
    out.duration_ms = msg.duration_ms;
    out.total_cost_usd = msg.total_cost_usd;
    out.num_turns = msg.num_turns;
    out.subtype = msg.subtype;
    out.is_error = msg.is_error || false;
    // Detect Claude usage/rate limit in result text
    const t = (msg.result || "").toLowerCase();
    if (
      t.includes("monthly spend limit") ||
      t.includes("session limit") ||
      t.includes("usage limit") ||
      t.includes("rate limit") ||
      msg.subtype === "error_max_turns"
    ) {
      out.rate_limited = true;
      const m = (msg.result || "").match(/resets?\s+([0-9:apm ]+\([^)]+\))/i);
      if (m) out.reset_at = m[1];
    }
  } else if (msg.type === "system") {
    out.kind = "system";
    out.subtype = msg.subtype;
  }
  return out;
}

function lastResultText(worker) {
  for (let i = worker.events.length - 1; i >= 0; i--) {
    const e = worker.events[i];
    if (e.kind === "result") return e.text || "";
    if (e.kind === "text") return e.text || "";
  }
  return "";
}

// ---------- Worker (one-shot) ----------

async function runWorker(id, task, opts = {}) {
  const worker = {
    id,
    task,
    role: opts.role || "worker",
    parentId: opts.parentId || null,
    status: "running",
    events: [],
    startedAt: Date.now(),
    finishedAt: null,
    error: null,
    lastActivity: Date.now(),
    toolCount: 0,
    isSession: false,
  };
  workers.set(id, worker);
  broadcast({ type: "worker:start", worker });
  saveWorkerNow(worker);

  try {
    const queryOptions = {
      cwd: opts.cwd || process.cwd(),
      permissionMode: opts.permissionMode || "bypassPermissions",
      maxTurns: opts.role === "manager" ? 30 : (opts.maxTurns || 15),
    };
    if (opts.model) queryOptions.model = opts.model;
    if (opts.allowedTools) queryOptions.allowedTools = opts.allowedTools;

    const iter = query({ prompt: task, options: queryOptions });

    for await (const msg of iter) {
      const event = summarizeEvent(msg);
      worker.events.push(event);
      worker.lastActivity = Date.now();
      if (event.kind === "tool_use") worker.toolCount++;
      if (event.kind === "result" && event.rate_limited) {
        worker.rate_limited = true;
        worker.reset_at = event.reset_at;
      }
      broadcast({ type: "worker:event", id, event });
      scheduleSave(worker);
    }
    worker.status = worker.rate_limited ? "rate_limited" : "completed";
    worker.finishedAt = Date.now();
    broadcast({ type: "worker:done", id, status: worker.status, rate_limited: worker.rate_limited, reset_at: worker.reset_at });
    saveWorkerNow(worker);
  } catch (err) {
    worker.status = "error";
    worker.error = err?.message || String(err);
    worker.finishedAt = Date.now();
    broadcast({ type: "worker:done", id, status: "error", error: worker.error });
    saveWorkerNow(worker);
    console.error(`[worker ${id}] error:`, err);
  }
  return worker;
}

// ---------- Manager MCP tools ----------

function makeManagerToolsFor(managerId, sharedOpts) {
  return createSdkMcpServer({
    name: "manager",
    version: "1.0.0",
    tools: [
      tool(
        "spawn_workers",
        "Spawn multiple worker subagents IN PARALLEL to handle a list of subtasks, then wait for all of them to finish. Use this to fan out independent work. Returns each worker's final result once every worker completes.",
        {
          tasks: z
            .array(
              z.object({
                task: z.string().describe("Full standalone prompt for this worker. Include file paths, context, and the exact question — workers do not share context with each other or with you."),
                label: z.string().optional().describe("Short human label shown in the UI"),
              })
            )
            .min(1),
        },
        async ({ tasks }) => {
          const ids = [];
          const promises = tasks.map((t) => {
            const id = randomUUID().slice(0, 8);
            ids.push(id);
            return runWorker(id, t.task, {
              cwd: sharedOpts.cwd,
              permissionMode: sharedOpts.permissionMode,
              parentId: managerId,
              role: "worker",
            });
          });
          const done = await Promise.all(promises);
          const results = done.map((w, i) => ({
            id: w.id,
            label: tasks[i].label,
            status: w.status,
            result: lastResultText(w).slice(0, 4000),
            error: w.error,
          }));
          return { content: [{ type: "text", text: JSON.stringify({ workers: results }, null, 2) }] };
        }
      ),

      tool(
        "spawn_worker",
        "Spawn a SINGLE worker subagent and wait. Use for sequential work or a follow-up refinement. For fan-out, prefer spawn_workers.",
        {
          task: z.string(),
          label: z.string().optional(),
        },
        async ({ task, label }) => {
          const id = randomUUID().slice(0, 8);
          const w = await runWorker(id, task, {
            cwd: sharedOpts.cwd,
            permissionMode: sharedOpts.permissionMode,
            parentId: managerId,
            role: "worker",
          });
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ id: w.id, label, status: w.status, result: lastResultText(w).slice(0, 4000), error: w.error }, null, 2),
            }],
          };
        }
      ),

      tool(
        "list_workers",
        "List all workers spawned by this manager with their current status.",
        {},
        async () => {
          const mine = Array.from(workers.values())
            .filter((w) => w.parentId === managerId)
            .map((w) => ({ id: w.id, task: w.task.slice(0, 100), status: w.status, toolCount: w.toolCount }));
          return { content: [{ type: "text", text: JSON.stringify(mine, null, 2) }] };
        }
      ),
    ],
  });
}

const MANAGER_SYSTEM_PROMPT = `You are a MANAGER agent shown as an avatar in a live OFFICE UI. Workers appear as avatars at desks when you spawn them. The user watches you delegate.

CRITICAL: Do NOT explore, read files, run bash, or investigate yourself. YOU HAVE NO Bash/Read/Grep/Write TOOLS. Your ONLY job is to DELEGATE via spawn_workers. If you need info about the codebase, spawn a DISCOVERY worker to investigate — never do it yourself. Your first action should ALWAYS be spawn_workers (or spawn_worker for a single task). Never call any other tool.

Tools:
- spawn_workers(tasks): fan out N workers in parallel — USE THIS for independent subtasks
- spawn_worker(task): run ONE worker
- list_workers(): inspect current worker fleet

For every worker task, you MUST specify:
1. goal — what to accomplish (one line)
2. deliverable — what the worker must return
3. proof_requirements — the EVIDENCE the worker must include so you can verify. Choose from:
     • "backend": raw command output, file contents, JSON, DB rows — anything from Bash/Read tools
     • "ui": screenshot / visual evidence (worker uses Playwright or curl+screenshot tool if available; if not, worker returns HTML source as proof)
     • "files": specific file paths the worker touched or produced, with line refs
     • "logs": excerpts from logs
   Every worker MUST attach proof of type(s) you asked for, in a section titled "PROOF:".

Workflow:
1. Read user goal (may include text + images).
2. Decompose into self-contained worker tasks. Each worker sees only its own prompt.
3. Call spawn_workers with a well-structured prompt per worker including the proof_requirements list explicitly.
4. When results return, VERIFY the proof. If a worker's proof is missing or weak, spawn a follow-up worker to re-do it or gather more evidence.
5. Reply briefly to the user with the synthesis and a one-line summary of which proofs you accepted.

Style rules:
- Keep your own text short, boss-like: "On it. Delegating to 3 workers.", "Worker 2's proof looks weak — reassigning.", "All checks passed. Report:"
- Worker prompts should read like a work order: "GOAL: … DELIVERABLE: … PROOF REQUIRED: [backend, files]. Include a PROOF section at the end."
- Always include absolute file paths in worker prompts. Workers share no context.
- Prefer parallelism.`;

// ---------- Manager session (streaming input, multi-turn) ----------

function createSession(id) {
  const state = { queue: [], resolvers: [], closed: false };
  sessions.set(id, state);
  return state;
}

function pushToSession(id, content) {
  const state = sessions.get(id);
  if (!state || state.closed) return false;
  const msg = { type: "user", message: { role: "user", content } };
  if (state.resolvers.length) {
    state.resolvers.shift()(msg);
  } else {
    state.queue.push(msg);
  }
  return true;
}

async function* sessionInput(state, initialContent) {
  yield { type: "user", message: { role: "user", content: initialContent } };
  while (!state.closed) {
    let msg;
    if (state.queue.length) {
      msg = state.queue.shift();
    } else {
      msg = await new Promise((r) => state.resolvers.push(r));
    }
    if (msg === null) return;
    yield msg;
  }
}

function contentToPreview(content) {
  const texts = content.filter((c) => c.type === "text").map((c) => c.text);
  const imgs = content.filter((c) => c.type === "image").length;
  let s = texts.join(" ");
  if (imgs) s += ` [+${imgs} image${imgs > 1 ? "s" : ""}]`;
  return s.trim();
}

async function runManagerSession(id, initialContent, opts = {}) {
  const state = createSession(id);
  const worker = {
    id,
    task: contentToPreview(initialContent) || "(image only)",
    role: "manager",
    parentId: null,
    status: "running",
    events: [],
    startedAt: Date.now(),
    finishedAt: null,
    error: null,
    lastActivity: Date.now(),
    toolCount: 0,
    isSession: true,
  };
  workers.set(id, worker);
  broadcast({ type: "worker:start", worker });
  saveWorkerNow(worker);

  // Log the initial user message as an event so the UI shows the chat
  const firstUserEvent = {
    type: "user_input",
    ts: Date.now(),
    kind: "user_message",
    text: contentToPreview(initialContent),
    imageCount: initialContent.filter((c) => c.type === "image").length,
  };
  worker.events.push(firstUserEvent);
  broadcast({ type: "worker:event", id, event: firstUserEvent });

  try {
    const iter = query({
      prompt: sessionInput(state, initialContent),
      options: {
        cwd: opts.cwd || process.cwd(),
        permissionMode: opts.permissionMode || "bypassPermissions",
        systemPrompt: { type: "preset", preset: "claude_code", append: MANAGER_SYSTEM_PROMPT },
        mcpServers: { manager: makeManagerToolsFor(id, { cwd: opts.cwd, permissionMode: opts.permissionMode || "bypassPermissions" }) },
        allowedTools: [
          "mcp__manager__spawn_workers",
          "mcp__manager__spawn_worker",
          "mcp__manager__list_workers",
        ],
        disallowedTools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob", "WebFetch", "WebSearch", "NotebookEdit", "TodoWrite"],
      },
    });

    for await (const msg of iter) {
      const event = summarizeEvent(msg);
      worker.events.push(event);
      worker.lastActivity = Date.now();
      if (event.kind === "tool_use") worker.toolCount++;
      if (event.kind === "result" && event.rate_limited) {
        worker.rate_limited = true;
        worker.reset_at = event.reset_at;
      }
      broadcast({ type: "worker:event", id, event });
      scheduleSave(worker);

      // After each result message, mark session as "idle" (waiting for next user message)
      if (event.kind === "result") {
        worker.status = event.rate_limited ? "rate_limited" : "idle";
        broadcast({ type: "worker:status", id, status: worker.status });
        saveWorkerNow(worker);
      } else if ((worker.status === "idle") && event.kind !== "system") {
        worker.status = "running";
        broadcast({ type: "worker:status", id, status: "running" });
      }
    }

    worker.status = worker.rate_limited ? "rate_limited" : "completed";
    worker.finishedAt = Date.now();
    broadcast({ type: "worker:done", id, status: worker.status });
    saveWorkerNow(worker);
  } catch (err) {
    worker.status = "error";
    worker.error = err?.message || String(err);
    worker.finishedAt = Date.now();
    broadcast({ type: "worker:done", id, status: "error", error: worker.error });
    saveWorkerNow(worker);
    console.error(`[manager ${id}] error:`, err);
  } finally {
    state.closed = true;
    sessions.delete(id);
  }
}

function buildContent({ text, images }) {
  const content = [];
  if (text && text.trim()) content.push({ type: "text", text });
  for (const img of images || []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType || "image/png", data: img.data },
    });
  }
  return content;
}

// ---------- HTTP endpoints ----------

app.post("/dispatch", (req, res) => {
  const { tasks, cwd, model, allowedTools, permissionMode } = req.body || {};
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "tasks must be a non-empty array" });
  }
  const ids = [];
  for (const task of tasks) {
    const id = randomUUID().slice(0, 8);
    ids.push(id);
    runWorker(id, task, { cwd, model, allowedTools, permissionMode });
  }
  res.json({ ids, count: ids.length });
});

app.post("/dispatch-manager", (req, res) => {
  const { goal, text, images = [], cwd, permissionMode } = req.body || {};
  const initialText = goal || text;
  const content = buildContent({ text: initialText, images });
  if (content.length === 0) {
    return res.status(400).json({ error: "provide text or images" });
  }
  const id = randomUUID().slice(0, 8);
  runManagerSession(id, content, { cwd, permissionMode });
  res.json({ managerId: id });
});

app.post("/workers/:id/message", (req, res) => {
  const worker = workers.get(req.params.id);
  if (!worker) return res.status(404).json({ error: "not found" });
  if (!worker.isSession) return res.status(400).json({ error: "not a session" });
  if (!sessions.has(req.params.id)) return res.status(400).json({ error: "session ended" });

  const { text, images = [] } = req.body || {};
  const content = buildContent({ text, images });
  if (content.length === 0) return res.status(400).json({ error: "provide text or images" });

  const userEvent = {
    type: "user_input",
    ts: Date.now(),
    kind: "user_message",
    text: contentToPreview(content),
    imageCount: images.length,
  };
  worker.events.push(userEvent);
  worker.status = "running";
  broadcast({ type: "worker:event", id: req.params.id, event: userEvent });
  broadcast({ type: "worker:status", id: req.params.id, status: "running" });

  pushToSession(req.params.id, content);
  res.json({ ok: true });
});

app.post("/workers/:id/end", (req, res) => {
  const state = sessions.get(req.params.id);
  if (!state) return res.status(404).json({ error: "not found" });
  state.closed = true;
  if (state.resolvers.length) state.resolvers.shift()(null);
  res.json({ ok: true });
});

app.post("/clear", (_req, res) => {
  const remaining = new Map();
  for (const [id, w] of workers) {
    if (w.status === "running" || w.status === "idle") remaining.set(id, w);
    else deleteWorkerFile(id);
  }
  workers.clear();
  for (const [id, w] of remaining) workers.set(id, w);
  broadcast({ type: "cleared", workers: Array.from(workers.values()) });
  res.json({ ok: true, kept: remaining.size });
});

app.delete("/workers/:id", (req, res) => {
  const w = workers.get(req.params.id);
  if (!w) return res.status(404).json({ error: "not found" });
  if (w.status === "running" || w.status === "idle") {
    return res.status(400).json({ error: "cannot delete a live session — end it first" });
  }
  workers.delete(req.params.id);
  deleteWorkerFile(req.params.id);
  broadcast({ type: "worker:deleted", id: req.params.id });
  res.json({ ok: true });
});

app.get("/workers", (_req, res) => {
  res.json(Array.from(workers.values()));
});

// ---------- CLI sessions (Claude Code history for this project) ----------

app.get("/cli-sessions", async (req, res) => {
  try {
    const all = await listSessions();
    const cwdFilter = req.query.cwd;
    const filtered = cwdFilter
      ? all.filter((s) => s.cwd === cwdFilter)
      : all;
    filtered.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get("/cli-sessions/:id/messages", async (req, res) => {
  try {
    const msgs = await getSessionMessages(req.params.id);
    const limit = Number(req.query.limit) || 50;
    const summarized = msgs.slice(-limit).map(summarizeSessionMessage);
    res.json({ total: msgs.length, messages: summarized });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

function summarizeSessionMessage(m) {
  const out = { type: m.type, ts: m.timestamp || null, uuid: m.uuid };
  if (m.type === "user" && m.message) {
    const content = m.message.content;
    if (typeof content === "string") {
      out.kind = "user_text";
      out.text = content;
    } else if (Array.isArray(content)) {
      const parts = [];
      let hasImg = 0;
      for (const c of content) {
        if (c.type === "text") parts.push(c.text);
        else if (c.type === "image") hasImg++;
        else if (c.type === "tool_result") {
          out.kind = "tool_result";
          const t = typeof c.content === "string" ? c.content : JSON.stringify(c.content);
          out.text = t.slice(0, 500);
          out.is_error = c.is_error;
        }
      }
      if (parts.length || hasImg) {
        out.kind = out.kind || "user_text";
        out.text = parts.join("\n");
        if (hasImg) out.imageCount = hasImg;
      }
    }
  } else if (m.type === "assistant" && m.message?.content) {
    const parts = [];
    const tools = [];
    for (const c of m.message.content) {
      if (c.type === "text") parts.push(c.text);
      else if (c.type === "tool_use") tools.push({ name: c.name, input: c.input });
      else if (c.type === "thinking") out.thinking = (c.thinking || "").slice(0, 300);
    }
    out.kind = "assistant";
    if (parts.length) out.text = parts.join("\n");
    if (tools.length) out.tools = tools.map((t) => ({ name: t.name, inputPreview: JSON.stringify(t.input).slice(0, 200) }));
  } else if (m.type === "summary") {
    out.kind = "summary";
    out.text = m.summary || "";
  }
  if (out.text) out.text = out.text.slice(0, 2000);
  return out;
}

app.get("/workers/:id", (req, res) => {
  const w = workers.get(req.params.id);
  if (!w) return res.status(404).json({ error: "not found" });
  res.json(w);
});

loadAllWorkersFromDisk();

const PORT = Number(process.env.PORT) || 3737;
server.listen(PORT, () => {
  console.log(`\n  Manager dashboard: http://localhost:${PORT}`);
  console.log(`  History: ${DATA_DIR}\n`);
});
