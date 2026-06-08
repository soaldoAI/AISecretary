import getDb from "@/lib/db";
import { logActivity } from "@/lib/activity";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const copilotTools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task on the Kanban board",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description (optional)" },
          status: { type: "string", enum: ["backlog", "todo", "in_progress", "review"], description: "Column to place the task in. Default: todo" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority. Default: medium" },
          assigned_to: { type: "number", description: "Agent ID to assign to (optional)" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format (optional)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_task",
      description: "Move a task to a different status column",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID (e.g. 5)" },
          status: { type: "string", enum: ["backlog", "todo", "in_progress", "review", "done"], description: "Target status column" },
        },
        required: ["task_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update task properties (title, priority, due_date, assigned_to). For descriptions, prefer add_comment to append rather than overwrite.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID" },
          title: { type: "string", description: "New title (optional)" },
          description: { type: "string", description: "Completely replaces the description. Use add_comment instead to append." },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "New priority (optional)" },
          due_date: { type: "string", description: "New due date YYYY-MM-DD or null to clear (optional)" },
          assigned_to: { type: "number", description: "Agent ID to assign, or 0 to unassign (optional)" },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_comment",
      description: "Add a comment or note to a task's description. This APPENDS to the existing description, never overwrites it. Use this when the user asks to add notes, comments, or extra info to a task.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID" },
          comment: { type: "string", description: "The comment or note to append to the description" },
        },
        required: ["task_id", "comment"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task from the board permanently",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID to delete" },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tasks",
      description: "Search tasks by keyword. Matches against title and description.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword" },
          status: { type: "string", enum: ["backlog", "todo", "in_progress", "review", "done"], description: "Filter by status column (optional)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_stats",
      description: "Get a dashboard summary: task counts by status, by priority, overdue count, and unassigned count.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_move_tasks",
      description: "Move all tasks from one status column to another. Example: move all review tasks to done.",
      parameters: {
        type: "object",
        properties: {
          from_status: { type: "string", enum: ["backlog", "todo", "in_progress", "review", "done"], description: "Source status column" },
          to_status: { type: "string", enum: ["backlog", "todo", "in_progress", "review", "done"], description: "Target status column" },
        },
        required: ["from_status", "to_status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_github_issues",
      description: "List open issues from the configured GitHub repository. Returns issue number, title, labels, and author.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "Filter by label name (optional)" },
          limit: { type: "number", description: "Max issues to return (default 10, max 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_agents",
      description: "List all available agents and their roles",
      parameters: { type: "object", properties: {} },
    },
  },
];

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const db = getDb();

  switch (name) {
    case "create_task": {
      const title = args.title as string;
      const description = (args.description as string) || "";
      const status = (args.status as string) || "todo";
      const priority = (args.priority as string) || "medium";
      const assigned_to = (args.assigned_to as number) || null;
      const due_date = (args.due_date as string) || null;

      const maxPos = db.prepare(
        "SELECT COALESCE(MAX(position), 0) + 1 as pos FROM tasks WHERE status = ?"
      ).get(status) as { pos: number };

      const result = db.prepare(
        "INSERT INTO tasks (title, description, status, priority, assigned_to, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(title, description, status, priority, assigned_to, due_date, maxPos.pos);

      const taskId = result.lastInsertRowid as number;
      logActivity(taskId, "Co-Pilot", "created", `Created task in ${status}`);

      return {
        success: true,
        message: `Created task #${taskId}: "${title}" in ${status}`,
        data: { id: taskId, title, status, priority },
      };
    }

    case "move_task": {
      const taskId = args.task_id as number;
      const newStatus = args.status as string;

      const task = db.prepare("SELECT id, title, status FROM tasks WHERE id = ?").get(taskId) as { id: number; title: string; status: string } | undefined;
      if (!task) return { success: false, message: `Task #${taskId} not found` };

      const maxPos = db.prepare(
        "SELECT COALESCE(MAX(position), 0) + 1 as pos FROM tasks WHERE status = ?"
      ).get(newStatus) as { pos: number };

      db.prepare("UPDATE tasks SET status = ?, position = ?, updated_at = datetime('now') WHERE id = ?")
        .run(newStatus, maxPos.pos, taskId);

      logActivity(taskId, "Co-Pilot", "moved", `${task.status} → ${newStatus}`);

      return {
        success: true,
        message: `Moved task #${taskId} "${task.title}" from ${task.status} → ${newStatus}`,
      };
    }

    case "update_task": {
      const taskId = args.task_id as number;
      const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
      if (!task) return { success: false, message: `Task #${taskId} not found` };

      const updates: string[] = [];
      const values: unknown[] = [];
      const changes: string[] = [];

      if (args.title !== undefined) { updates.push("title = ?"); values.push(args.title); changes.push(`title → ${args.title}`); }
      if (args.description !== undefined) { updates.push("description = ?"); values.push(args.description); changes.push("description replaced"); }
      if (args.priority !== undefined) { updates.push("priority = ?"); values.push(args.priority); changes.push(`priority → ${args.priority}`); }
      if (args.due_date !== undefined) { updates.push("due_date = ?"); values.push(args.due_date === "null" ? null : args.due_date); changes.push(`due_date → ${args.due_date}`); }
      if (args.assigned_to !== undefined) { updates.push("assigned_to = ?"); values.push(args.assigned_to === 0 ? null : args.assigned_to); changes.push(`assigned_to → ${args.assigned_to}`); }

      if (updates.length === 0) return { success: false, message: "No fields to update" };

      updates.push("updated_at = datetime('now')");
      values.push(taskId);

      db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      logActivity(taskId, "Co-Pilot", "updated", changes.join("; "));

      return {
        success: true,
        message: `Updated task #${taskId}: ${changes.join(", ")}`,
      };
    }

    case "add_comment": {
      const taskId = args.task_id as number;
      const comment = args.comment as string;

      const task = db.prepare("SELECT id, title, description FROM tasks WHERE id = ?").get(taskId) as { id: number; title: string; description: string } | undefined;
      if (!task) return { success: false, message: `Task #${taskId} not found` };

      const existing = (task.description || "").trim();
      const newDesc = existing ? existing + "\n\n" + comment : comment;

      db.prepare("UPDATE tasks SET description = ?, updated_at = datetime('now') WHERE id = ?").run(newDesc, taskId);
      logActivity(taskId, "Co-Pilot", "commented", comment);

      return {
        success: true,
        message: `Added comment to task #${taskId} "${task.title}"`,
      };
    }

    case "delete_task": {
      const taskId = args.task_id as number;
      const task = db.prepare("SELECT id, title FROM tasks WHERE id = ?").get(taskId) as { id: number; title: string } | undefined;
      if (!task) return { success: false, message: `Task #${taskId} not found` };

      db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
      return { success: true, message: `Deleted task #${taskId}: "${task.title}"` };
    }

    case "search_tasks": {
      const query = args.query as string;
      const status = args.status as string | undefined;

      let sql = "SELECT id, title, description, status, priority, assigned_to, due_date FROM tasks WHERE (title LIKE ? OR description LIKE ?)";
      const params: unknown[] = [`%${query}%`, `%${query}%`];

      if (status) {
        sql += " AND status = ?";
        params.push(status);
      }

      sql += " ORDER BY updated_at DESC LIMIT 20";

      const tasks = db.prepare(sql).all(...params) as Array<{
        id: number; title: string; description: string;
        status: string; priority: string; assigned_to: number | null; due_date: string | null;
      }>;

      return {
        success: true,
        message: `Found ${tasks.length} task(s) matching "${query}"`,
        data: tasks,
      };
    }

    case "task_stats": {
      const byStatus = db.prepare(
        "SELECT status, COUNT(*) as count FROM tasks GROUP BY status"
      ).all() as Array<{ status: string; count: number }>;

      const byPriority = db.prepare(
        "SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority"
      ).all() as Array<{ priority: string; count: number }>;

      const overdue = db.prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE due_date < date('now') AND status != 'done'"
      ).get() as { count: number };

      const unassigned = db.prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE assigned_to IS NULL AND status != 'done'"
      ).get() as { count: number };

      const total = db.prepare(
        "SELECT COUNT(*) as count FROM tasks"
      ).get() as { count: number };

      const statusMap: Record<string, number> = {};
      for (const row of byStatus) statusMap[row.status] = row.count;

      const priorityMap: Record<string, number> = {};
      for (const row of byPriority) priorityMap[row.priority] = row.count;

      return {
        success: true,
        message: `Board summary: ${total.count} total tasks, ${overdue.count} overdue, ${unassigned.count} unassigned`,
        data: {
          total: total.count,
          by_status: statusMap,
          by_priority: priorityMap,
          overdue: overdue.count,
          unassigned: unassigned.count,
        },
      };
    }

    case "bulk_move_tasks": {
      const fromStatus = args.from_status as string;
      const toStatus = args.to_status as string;

      if (fromStatus === toStatus) return { success: false, message: "Source and target columns are the same" };

      const tasks = db.prepare(
        "SELECT id, title FROM tasks WHERE status = ?"
      ).all(fromStatus) as Array<{ id: number; title: string }>;

      if (tasks.length === 0) return { success: false, message: `No tasks in ${fromStatus}` };

      const maxPos = db.prepare(
        "SELECT COALESCE(MAX(position), 0) as pos FROM tasks WHERE status = ?"
      ).get(toStatus) as { pos: number };

      const update = db.prepare(
        "UPDATE tasks SET status = ?, position = ?, updated_at = datetime('now') WHERE id = ?"
      );

      const moveAll = db.transaction(() => {
        let pos = maxPos.pos;
        for (const task of tasks) {
          pos++;
          update.run(toStatus, pos, task.id);
          logActivity(task.id, "Co-Pilot", "moved", `${fromStatus} → ${toStatus} (bulk)`);
        }
      });

      moveAll();

      return {
        success: true,
        message: `Moved ${tasks.length} task(s) from ${fromStatus} → ${toStatus}`,
        data: { count: tasks.length, task_ids: tasks.map(t => t.id) },
      };
    }

    case "list_github_issues": {
      const repo = process.env.GITHUB_REPO;
      if (!repo) return { success: false, message: "GITHUB_REPO not configured. Set it in .env (e.g. owner/repo)." };

      const label = args.label as string | undefined;
      const limit = Math.min(Math.max((args.limit as number) || 10, 1), 30);

      const params = new URLSearchParams({ state: "open", per_page: String(limit) });
      if (label) params.set("labels", label);

      const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
      const token = process.env.GITHUB_TOKEN;
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`https://api.github.com/repos/${repo}/issues?${params}`, { headers });
      if (!res.ok) {
        const body = await res.text();
        return { success: false, message: `GitHub API error (${res.status}): ${body}` };
      }

      const issues = (await res.json()) as Array<{
        number: number; title: string; state: string;
        labels: Array<{ name: string }>; user: { login: string };
        created_at: string; html_url: string; pull_request?: unknown;
      }>;

      // Filter out pull requests (GitHub returns PRs in the issues endpoint)
      const realIssues = issues.filter(i => !i.pull_request);

      const formatted = realIssues.map(i => ({
        number: i.number,
        title: i.title,
        labels: i.labels.map(l => l.name),
        author: i.user.login,
        created: i.created_at,
        url: i.html_url,
      }));

      return {
        success: true,
        message: `Found ${formatted.length} open issue(s) in ${repo}`,
        data: formatted,
      };
    }

    case "list_agents": {
      const agents = db.prepare("SELECT id, name, role FROM agents ORDER BY id").all();
      return { success: true, message: "Agent roster", data: agents };
    }

    default:
      return { success: false, message: `Unknown tool: ${name}` };
  }
}
