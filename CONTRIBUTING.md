# Contributing to AISecretary

Thanks for your interest in AISecretary! We're building an open-source, self-hosted workspace where AI agents actually do work — not just chat. This guide will help you get started.

## Vision

AISecretary is a Kanban-based workspace where AI agents read the board, take action, and report back. Think of it as a private office staffed by AI — running on your own hardware, with your own data.

We want to grow this into a **full agentic AI platform** where:
- Agents can be added as plugins
- Agents can delegate work to each other
- Everything runs locally — no cloud lock-in
- The tool system is extensible (5 tools today, 50 tomorrow)

## Architecture Overview

```
AISecretary/
├── src/
│   ├── app/api/           # Next.js API routes (REST endpoints)
│   │   ├── tasks/         # CRUD for Kanban tasks
│   │   ├── agents/        # Agent roster
│   │   ├── copilot/       # AI chat + tool calling
│   │   ├── calendar/      # Google Calendar OAuth
│   │   └── bookings/      # Self-hosted booking system
│   ├── components/        # React UI components
│   └── lib/
│       ├── db.ts          # SQLite connection (better-sqlite3)
│       ├── migrate.ts     # Forward-only migration runner
│       ├── activity.ts    # Agent activity log
│       ├── types.ts       # Shared TypeScript types
│       ├── google-calendar.ts
│       └── copilot/
│           ├── llm.ts     # LLM provider abstraction (OpenRouter/OpenAI/Ollama)
│           ├── context.ts # System prompt + task context injection
│           └── tools.ts   # Tool definitions + execution <-- START HERE
├── migrations/            # SQL migrations (sequential, forward-only)
├── kanban.db              # SQLite database (gitignored)
└── .env.local             # Secrets (gitignored)
```

### Key Concepts

- **Agents** — Named AI personas (Atlas=Sales, Nova=Marketing, Forge=Developer, etc.) stored in the `agents` table. Tasks are assigned to agents.
- **Tools** — Functions the Co-Pilot can call via OpenAI-compatible tool calling. Defined in `src/lib/copilot/tools.ts`.
- **Activity Log** — Every agent action is logged in the `task_activity` table for auditability.
- **Providers** — The LLM layer supports OpenRouter, OpenAI, and Ollama interchangeably.

## How to Add a New Tool

This is the easiest way to contribute. Tools give the Co-Pilot new capabilities.

### 1. Define the tool in `src/lib/copilot/tools.ts`

Add an entry to the `copilotTools` array:

```typescript
{
  type: "function",
  function: {
    name: "search_tasks",
    description: "Search tasks by keyword in title or description",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword" },
      },
      required: ["query"],
    },
  },
},
```

### 2. Implement the handler in `executeTool()`

Add a case to the switch statement:

```typescript
case "search_tasks": {
  const query = args.query as string;
  const tasks = db.prepare(
    "SELECT id, title, status, priority FROM tasks WHERE title LIKE ? OR description LIKE ?"
  ).all(`%${query}%`, `%${query}%`);
  return {
    success: true,
    message: `Found ${tasks.length} tasks matching "${query}"`,
    data: tasks,
  };
}
```

### 3. Test it

Start the dev server, open the Co-Pilot chat, and ask it to use your tool.

```bash
npm run dev
# Open http://localhost:3000
# Click the Co-Pilot chat button
# Ask: "Search for tasks about marketing"
```

The LLM will automatically discover and call your tool based on the user's intent.

## How to Add an Integration

Integrations connect AISecretary to external services.

1. Create a new API route in `src/app/api/your-integration/`
2. Add any config to `.env.example`
3. Optionally add a Co-Pilot tool so the AI can trigger it
4. Add a migration in `migrations/` if you need new tables

Current integrations to use as reference:
- `src/app/api/calendar/` — Google Calendar OAuth flow
- `src/app/api/bookings/` — Self-hosted booking system
- `src/lib/copilot/tools.ts` — Tool calling system

## How to Add a Database Migration

Migrations live in `migrations/` and are numbered sequentially:

```
migrations/
├── 0001_baseline.sql
├── 0002_copilot.sql
├── 0003_calendar_bookings.sql
├── 0004_task_activity.sql
└── 0005_your_feature.sql    <-- add yours here
```

The migration runner (`src/lib/migrate.ts`) executes them in order on startup. Each migration runs once. Just add a new `.sql` file — no config needed.

## Development Setup

```bash
git clone https://github.com/soaldoAI/AISecretary.git
cd AISecretary
npm install
cp .env.example .env.local
# Edit .env.local with your API key (OpenRouter, OpenAI, or Ollama)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running with Ollama (free, local)

If you don't want to pay for an API key:

```bash
# Install Ollama: https://ollama.com
ollama pull llama3.2:3b
```

Set in `.env.local`:
```
COPILOT_DEFAULT_PROVIDER=ollama
COPILOT_DEFAULT_MODEL=llama3.2:3b
```

## Contribution Areas

### Good First Issues
- Add new Co-Pilot tools (search tasks, get task stats, bulk operations)
- Add dark/light theme toggle
- Add task labels/tags
- Add keyboard shortcuts

### Integrations
- Slack notifications
- GitHub Issues sync
- Notion import/export
- Email (IMAP/SMTP) integration
- Linear sync
- Webhook system for external triggers

### Agent System
- Agent plugin architecture — load agents from a `/agents` directory
- Agent-to-agent delegation (e.g., Forge assigns a QA task to Sentinel)
- Scheduled agent actions (cron-based, not just chat-triggered)
- Agent memory — persistent context per agent across conversations
- RAG over business documents (PDFs, notes, emails)

### Infrastructure
- Docker support
- Multi-user auth
- Backup/restore tooling
- Mobile app (React Native)

## Pull Request Guidelines

1. **One feature per PR** — keep it focused
2. **Test your changes** — run `npm run build` to make sure it compiles
3. **Update `.env.example`** if you add new environment variables
4. **Add a migration** if you change the database schema
5. **Keep it simple** — we prefer 20 clear lines over 5 clever ones

## Code Style

- TypeScript strict mode
- Functional components (React)
- No ORMs — raw SQL with better-sqlite3 (it's fast and explicit)
- Tailwind CSS 4 for styling
- Prefer server components; use `"use client"` only when needed

## Questions?

Open an issue or start a discussion on GitHub. We're friendly and responsive.
