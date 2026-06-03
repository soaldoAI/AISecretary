import getDb from "@/lib/db";

interface BoardSummary {
  systemPrompt: string;
  boardSnapshot: string;
}

export function buildCopilotContext(): BoardSummary {
  const db = getDb();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const today = now.slice(0, 10);

  // Board summary counts
  const statusCounts = db
    .prepare(
      "SELECT status, COUNT(*) as count FROM tasks GROUP BY status"
    )
    .all() as { status: string; count: number }[];

  const priorityCounts = db
    .prepare(
      "SELECT priority, COUNT(*) as count FROM tasks WHERE status != 'done' GROUP BY priority"
    )
    .all() as { priority: string; count: number }[];

  const overdueCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE due_date < ? AND status != 'done'"
    )
    .get(today) as { count: number };

  // Active tasks (non-done), ordered: overdue first, then priority, then due_date
  const activeTasks = db
    .prepare(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to,
              a.name as agent_name, a.role as agent_role
       FROM tasks t
       LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.status != 'done'
       ORDER BY
         CASE WHEN t.due_date < ? THEN 0 ELSE 1 END,
         CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         t.due_date ASC NULLS LAST
       LIMIT 150`
    )
    .all(today) as {
      id: number;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
      assigned_to: number | null;
      agent_name: string | null;
      agent_role: string | null;
    }[];

  // Agent roster
  const agents = db
    .prepare("SELECT name, role FROM agents ORDER BY id")
    .all() as { name: string; role: string }[];

  // Build compact summary
  const statusLine = statusCounts.map((s) => `${s.status}:${s.count}`).join("  ");
  const priorityLine = priorityCounts.map((p) => `${p.priority}:${p.count}`).join("  ");
  const agentRoster = agents.map((a) => `${a.name} (${a.role})`).join(", ");

  // Build task rows
  const taskRows = activeTasks
    .map((t) => {
      const due = t.due_date
        ? t.due_date < today
          ? `${t.due_date}(OVERDUE)`
          : t.due_date
        : "no date";
      const assignee = t.agent_name
        ? `${t.agent_name}(${t.agent_role})`
        : "unassigned";
      return `#${t.id} | ${t.status} | ${t.priority} | ${due} | ${assignee} | ${t.title}`;
    })
    .join("\n");

  const boardSnapshot = `## BOARD SUMMARY (generated ${now})
${statusLine} | overdue:${overdueCount.count} | ${priorityLine}

## ACTIVE TASKS (id | status | priority | due | assignee | title)
${taskRows || "No active tasks."}`;

  const systemPrompt = `You are the Co-Pilot inside AISecretary, a private AI office for a solo founder.
Today is ${today}.

Be concise and action-oriented. When asked about tasks, priorities, or the board, use ONLY the data below.
If you don't know something, say so — never invent tasks or IDs.
You can CREATE, MOVE, UPDATE, and DELETE tasks using tools. When the user asks you to do something on the board, use the appropriate tool. Always confirm what you did after acting.

## TEAM
${agentRoster}

${boardSnapshot}`;

  return { systemPrompt, boardSnapshot };
}
