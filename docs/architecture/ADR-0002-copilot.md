# ADR-0002: Co-Pilot Chat (LLM + retrieval over the tasks DB)

## Status

Proposed

## Context

Launchdesk is a private, self-hosted "AI office" for a **single** founder, running on
an Intel NUC7i7BNH (i7-7567U, 16 GB RAM, **no GPU**, Ubuntu) reached over Tailscale.
The roadmap calls for a **Co-Pilot chat**: a conversational assistant grounded in the
founder's own data that can answer questions like *"What's overdue?"*, *"What should I
focus on today?"*, *"Summarize the sales pipeline"*, and (later) *"Create a task for X"*.

The assistant needs **retrieval** because a raw LLM has no knowledge of the founder's
board. The thing it retrieves over is the existing SQLite database — primarily
`tasks` (joined to `agents`), and later business memory. The interesting design
tension is that the obvious "RAG" answer (embeddings + a vector store) is wildly
over-built for *one user with hundreds of tasks*. The whole dataset is tiny.

Constraints that shape every decision below:

- **No GPU, modest CPU.** Local inference (Ollama) is possible but slow; only small
  quantized models are viable, and even those will feel sluggish. Cloud (OpenRouter)
  is the realistic default for quality + speed.
- **SQLite is the only datastore.** No Postgres/Redis/external vector DB. Any retrieval
  must live inside SQLite or in-process. `better-sqlite3` runs **synchronously** in the
  Node process (see `src/lib/db.ts`), which is fine here — the DB is small and there is
  one user.
- **Privacy-first.** Data must not leave the NUC except for the LLM API call itself, and
  we should send the *minimum* necessary context.
- **Simplicity is the product.** Single Next.js 16 app, no microservices, no queues, no
  Python sidecar, no orchestration framework.
- **Exactly one user.** Never design for concurrency or scale.

### Confirmed facts (read once)

- `migrations/0001_baseline.sql` defines `agents` and `tasks` with `INTEGER PRIMARY KEY
  AUTOINCREMENT`, `TEXT` timestamps via `created_at TEXT DEFAULT (datetime('now'))`, and
  indexes `idx_tasks_status` / `idx_tasks_assigned`. Schema is owned exclusively by
  versioned raw-SQL migrations run by `src/lib/migrate.ts`; **data seeding stays out of
  migrations**.
- `tasks(id, title, description, status[backlog|todo|in_progress|review|done],
  priority[low|medium|high|urgent], assigned_to→agents.id, due_date, position,
  created_at, updated_at)`; `agents(id, name, role, avatar, created_at)` with 10 seeded
  agents.
- API conventions (`src/app/api/tasks/route.ts`, `src/app/api/agents/route.ts`):
  - Plain App Router Route Handlers exporting `GET`/`POST`.
  - `getDb()` from `@/lib/db`, synchronous prepared statements.
  - JSON via `NextResponse.json(...)`; create returns `201`; validation errors return
    `{ error: string }` with `400`. Tasks are returned with a nested `agent` object
    built from a `LEFT JOIN agents`.
- **Next.js 16 route-handler/streaming specifics** (confirmed in
  `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and
  `.../02-guides/streaming.md`):
  - Route Handlers are Web `Request`/`Response` handlers. **`POST` is never cached** (and
    `GET` is uncached by default), so our chat endpoint needs no special cache opt-out.
  - **Streaming is done with the Web Streams API**: build a `new ReadableStream`, enqueue
    `TextEncoder`-encoded chunks from `start(controller)`, and return it as a `Response`.
    This is the documented pattern for Server-Sent Events / progressive responses — there
    is no Next-specific streaming helper to reach for.
  - Dynamic-segment params are now **async**: `ctx.params` is awaited and can be typed with
    the generated `RouteContext<'/path/[id]'>` helper. (Differs from the older synchronous
    `params` assumption — relevant if we add `/api/copilot/conversations/[id]`.)
  - `use cache` cannot be used inside a Route Handler body. Not needed here.

## Decision

### 1. LLM provider strategy

**Default to OpenRouter (cloud); keep Ollama (local) as an optional fallback.** On this
NUC, cloud is the only way to get acceptable latency and answer quality. Ollama is
supported but explicitly documented as the slow, offline-only path.

Both providers speak an **OpenAI-compatible Chat Completions API** (OpenRouter natively;
Ollama via its `/v1/chat/completions` endpoint). We therefore write **one thin client**
against that shape and switch only the base URL / API key / model — no provider-specific
SDKs, no LangChain.

**Configuration** uses a hybrid of env vars (secrets + base config) and a `settings`
table (user-tweakable runtime prefs, so the founder can change model/provider from the UI
without editing `.env` and restarting):

```
# .env (secrets + defaults — never sent to UI)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
COPILOT_DEFAULT_PROVIDER=openrouter
COPILOT_DEFAULT_MODEL=openai/gpt-4o-mini
```

Runtime-overridable values (`provider`, `model`, `temperature`, `max_context_tasks`) live
in the `settings` table and fall back to env defaults when unset. The API key stays
**server-side only** and is never returned by any endpoint.

**Recommended lightweight defaults:**

- **OpenRouter:** a small, cheap, fast instruction model — e.g. `openai/gpt-4o-mini` (or
  `google/gemini-flash`-class / `anthropic/claude-haiku`-class). These are plenty for
  "summarize my board" tasks at trivial cost.
- **Ollama (CPU-only fallback):** a 3B–8B quantized model such as `llama3.2:3b` or
  `qwen2.5:3b-instruct` (Q4). Be explicit in the UI: on a GPU-less i7-7567U expect
  **multi-second-per-response, low tokens/sec**; reserve it for offline/privacy-critical
  use, not daily driving.

**What is sent to the cloud, and minimizing it:** only the system prompt, a compact
retrieved task slice (see §2), and the current conversation turn(s). We send **task
titles/status/priority/due_date/assignee — not** raw descriptions unless the user's query
clearly needs them (and never anything outside the tasks/agents scope). No DB dumps, no
secrets, no PII beyond what the founder typed. When `provider = ollama`, **nothing leaves
the NUC at all** — the privacy-maximal mode.

### 2. Retrieval / RAG strategy

Three options were weighed for *one user with hundreds of tasks*:

| Option | Fit for this app | Verdict |
| --- | --- | --- |
| (a) Put the relevant/whole task list in the prompt | Dataset is tiny; a few hundred tasks as compact rows ≈ a few thousand tokens, well within a small model's context | **Chosen for MVP** |
| (b) FTS5 keyword retrieval | Useful only once the corpus (notes, long descriptions, business memory) grows past the context budget | Deferred |
| (c) sqlite-vec embeddings | Requires an embedding model + extension + indexing pipeline; semantic recall is overkill for structured task rows | Rejected for MVP |

**Decision: MVP retrieval = "structured board snapshot in context."** Query the DB with the
existing join, render a **compact, deterministic** representation of the relevant tasks,
and inline it into the system/context message. This needs **zero new infrastructure**, is
fully inspectable, and is trivially correct.

To stay cheap and bounded we apply **cheap pre-filtering in SQL rather than semantic
retrieval**:

- Always include a small **board summary** (counts per status, count overdue, count by
  priority) — answers most "what should I focus on" / "what's overdue" questions directly.
- Include the **active, non-done** tasks in full-row form, ordered by a sensible relevance
  proxy (overdue first, then priority desc, then due_date asc), capped at
  `settings.max_context_tasks` (default ~150).
- `done` tasks are summarized (counts) unless the query is clearly historical.

**Context format** — compact pipe-delimited rows beat verbose JSON for token efficiency
and are easy for small models to read:

```
## BOARD SUMMARY (generated 2026-05-29T...)
backlog:12  todo:8  in_progress:5  review:2  done:140  | overdue:3  urgent:1  high:6

## ACTIVE TASKS  (id | status | priority | due | assignee | title)
#42 | in_progress | urgent | 2026-05-20(OVERDUE) | Atlas(Sales) | Close ACME renewal
#37 | todo        | high   | 2026-06-02         | Forge(Developer) | Ship billing webhook
...
```

We render this in a pure helper (e.g. `src/lib/copilot/context.ts`, to be built later) so
it is unit-testable and provider-agnostic. **Migration to FTS5 is a localized swap** of
that helper if/when business-memory text outgrows the budget — no API or schema churn.

### 3. Data model (proposed `migrations/0002_copilot.sql`)

Two tables for chat persistence plus a small `settings` key/value table (justified: it
lets the founder change provider/model/temperature from the UI without editing `.env`,
and it is the natural home for future Co-Pilot prefs). **This SQL is a proposal embedded
in this ADR — the migration file is owned by another workstream and is intentionally NOT
created here.**

```sql
-- migrations/0002_copilot.sql  (PROPOSED — do not apply from this ADR)
-- Co-Pilot chat persistence + runtime settings.
-- Style matches 0001_baseline.sql: INTEGER PK AUTOINCREMENT, TEXT timestamps via
-- datetime('now'), IF NOT EXISTS so it is a safe no-op on an existing live DB.

CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content         TEXT NOT NULL DEFAULT '',
  -- Optional provenance/diagnostics for a single message (model used, token counts,
  -- tool calls). JSON kept as TEXT — no JSON column type in SQLite, app parses it.
  meta            TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Hot path is "load a conversation's messages in order".
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id, id);

-- Conversation list is ordered by recency.
CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at DESC);
```

**Index notes.** `idx_messages_conversation(conversation_id, id)` covers the only message
read pattern (fetch a thread in insertion order). `idx_conversations_updated` supports the
sidebar list. `settings` is a tiny PK-only table; no extra index. `ON DELETE CASCADE`
requires `foreign_keys = ON`, which `src/lib/db.ts` already pragmas on. With one user there
is no write contention to worry about.

### 4. API design

New routes under `src/app/api/copilot/`, matching existing conventions (`getDb()`,
`NextResponse.json`, `{ error }` + status codes).

**`POST /api/copilot/chat` — send a message, stream the reply.**

Request:

```jsonc
{
  "conversationId": 12,          // optional; omitted/null => create a new conversation
  "message": "What's overdue?",
  "provider": "openrouter",      // optional override; else settings/env default
  "model": "openai/gpt-4o-mini"  // optional override
}
```

Flow: validate (`message` non-empty → `400 { error: "Message is required" }`); create the
conversation if needed; persist the user message; build the board snapshot (§2) + system
prompt (§6); call the provider with `stream: true`; **stream tokens to the client via a
`ReadableStream` Response**; on completion persist the assistant message (with `meta`:
model, token usage) and bump `conversations.updated_at`.

Response is a **streamed `text/event-stream`** built with the Web Streams API (the
Next.js 16 documented pattern):

```ts
// sketch — final code lives in the route handler, not this ADR
const stream = new ReadableStream({
  async start(controller) {
    const enc = new TextEncoder();
    try {
      for await (const delta of providerStream) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
      }
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, conversationId })}\n\n`));
    } catch (err) {
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
    } finally {
      controller.close();
    }
  },
});
return new Response(stream, {
  headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
});
```

> Note (from the streaming docs): keep an eye on small-payload buffering (Safari buffers
> until 1024 bytes); SSE framing with `\n\n` flushes fine in practice. A non-streaming
> fallback (`stream:false` → single `NextResponse.json`) is trivial to keep for clients
> that don't want SSE.

**`GET /api/copilot/conversations`** → list `{ id, title, updated_at }` ordered by
`updated_at DESC` (sidebar).

**`POST /api/copilot/conversations`** → create empty conversation, return `201`.
**`GET /api/copilot/conversations/[id]`** → conversation + ordered messages (uses async
`ctx.params` per Next 16). `404 { error: "Not found" }` if missing.
**`DELETE /api/copilot/conversations/[id]`** → delete (cascades messages).

**Error handling** (all return JSON `{ error }` for non-streamed paths; for the streamed
path, errors are emitted as a terminal `data:` event so the UI can surface them):

- **Provider down / network error** → `502 { error: "LLM provider unavailable" }`.
- **Timeout** → wrap the provider fetch in an `AbortController` (e.g. 60s);
  `504 { error: "LLM request timed out" }`. Important because Ollama on this NUC can be
  slow.
- **Rate limit (429 from OpenRouter)** → pass through `429` with a friendly message;
  optionally suggest switching to Ollama.
- **Validation** → `400` consistent with existing routes.

### 5. Tool / function calling

**MVP = read-only.** The Co-Pilot answers from the board snapshot only; it does **not**
mutate data. This avoids confirmation UX, audit, and accidental-write risk while
delivering ~90% of the value ("what's overdue", "what should I focus on", "summarize the
pipeline").

**Next iteration = a small set of write tools** behind the provider's function-calling
interface: `create_task`, `update_task_status`, `assign_task`. These map directly onto
existing logic in `src/app/api/tasks/*`. Guardrails when added:

- **Human-in-the-loop confirmation**: the model *proposes* a tool call; the UI renders a
  confirm card; the write executes only on the founder's click.
- **Auditability**: every executed action is recorded — naturally captured in
  `messages.role = 'tool'` with `meta` (tool name, args, result), and designed to dovetail
  with the future **audit-trail** feature rather than inventing a parallel log now.

### 6. Prompt / system design

System prompt (assembled per request, server-side) contains:

1. **Identity & founder context**: "You are the Co-Pilot inside Launchdesk, a private AI
   office for a solo founder. Be concise and action-oriented." Today's date (for
   overdue/`due_date` reasoning).
2. **Agent roster**: the 10 seeded agents as `name (role)` so the model can attribute work
   and resolve "who's handling X".
3. **Current board snapshot**: the compact summary + active-task rows from §2.
4. **Behavior rules**: answer only from provided data; if unknown, say so; don't invent
   tasks/ids; (MVP) you cannot modify the board.

**Token-budget management** (matters for both cost and small-model context limits):

- Hard cap on injected tasks via `settings.max_context_tasks`; prefer summary counts over
  full rows when over budget.
- **Truncate conversation history**: send the last *N* turns (e.g. 6–8) plus the fresh
  snapshot, rather than the whole thread — the snapshot is re-derived each turn so old
  context is rarely needed.
- Compact pipe-delimited rows (not JSON) and dropped task descriptions by default keep the
  snapshot to a few thousand tokens even with a full board.

## Alternatives considered

- **Embeddings / vector search now (sqlite-vec).** Rejected for MVP. Adds an embedding
  model, an extension, and an indexing pipeline to gain *semantic recall over a dataset
  that fits entirely in context*. Pure over-engineering for one user with hundreds of
  structured rows. Revisit only when free-text business memory grows large.
- **Dump the entire DB every message.** Rejected. Wastes tokens/$ (especially `done` tasks
  and descriptions), leaks more than necessary to the cloud, and degrades small-model
  focus. The §2 SQL pre-filter + summary is strictly better at the same simplicity level.
- **Separate Python RAG service (FastAPI + LlamaIndex/etc.).** Rejected — violates the
  single-app / no-microservices constraint, adds a process to babysit on the NUC, and buys
  nothing the in-process helper doesn't.
- **LangChain / heavy agent framework.** Rejected — large dependency surface and
  abstraction tax for what is one OpenAI-compatible HTTP call plus a string-builder. A thin
  client keeps the code legible and the bundle small.
- **FTS5 keyword retrieval for MVP.** Deferred, not rejected. Sound when the corpus exceeds
  the context budget; unnecessary while everything fits. Designed as a drop-in swap of the
  context helper.

## Consequences

**Positive**

- Ships fast: no new infra, no embeddings, no extra services. Mostly a route handler, a
  thin LLM client, a context builder, and two tables.
- Cheap: small cloud models + a bounded snapshot ≈ a few thousand tokens per turn →
  fractions of a cent per message.
- Private by construction: only a minimized, scoped snapshot leaves the NUC, and the Ollama
  path keeps everything local.
- Inspectable & correct: the exact context can be logged/printed; no opaque vector recall.

**Trade-offs / costs**

- **Cloud dependency for good UX.** OpenRouter outages or rate limits degrade the
  assistant; mitigated by the Ollama fallback (with an explicit slowness warning).
- **Latency on this hardware.** OpenRouter is fast; **Ollama on the GPU-less i7-7567U is
  slow** (small models only, low tokens/sec). Streaming masks some of it; timeouts protect
  the rest.
- **Token/$ scaling with board size.** A very large `done` history could bloat context if
  naively included — hence summary-by-default and the `max_context_tasks` cap.
- **Privacy: cloud calls do leave the NUC.** Unavoidable for cloud LLMs; minimized by
  scope-limiting the payload and never sending secrets/descriptions by default.

**Deferred**

- FTS5 / sqlite-vec retrieval, write/tool actions + confirmation UX, audit-trail
  integration, business-memory retrieval, multi-agent routing, per-conversation model
  pinning beyond the global setting.

## MVP definition

**First iteration (build this):**

1. `migrations/0002_copilot.sql` (proposed above) → `conversations`, `messages`,
   `settings`. *(Authored by the migrations workstream, not from this ADR.)*
2. **Read-only** Co-Pilot. No task writes, no function calling.
3. **OpenRouter only**, default `openai/gpt-4o-mini`, key + defaults from `.env`. (Ollama
   wiring is structured for but not required in MVP.)
4. **Retrieval = board snapshot in context** (summary + active tasks, SQL pre-filtered,
   compact pipe rows). No FTS5, no embeddings.
5. `POST /api/copilot/chat` with **`ReadableStream`/SSE streaming** (Next 16 Web Streams
   pattern), persisting user + assistant messages.
6. `GET/POST /api/copilot/conversations` and `GET/DELETE
   /api/copilot/conversations/[id]` for history.
7. Basic chat UI (conversation sidebar + streamed message view).

**Next iterations:**

- Ollama provider toggle exposed in settings UI (with slowness warning).
- Write tools (`create_task`, `update_task_status`, `assign_task`) with confirm-card UX +
  audit-trail integration.
- FTS5 retrieval once business memory / long-form text lands.
- Per-conversation model/provider override.
