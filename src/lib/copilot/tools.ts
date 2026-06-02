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

export function executeTool(name: string, args: Record<string, unknown>): ToolResult {
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

    case "list_agents": {
      const agents = db.prepare("SELECT id, name, role FROM agents ORDER BY id").all();
      return { success: true, message: "Agent roster", data: agents };
    }

    default:
      return { success: false, message: `Unknown tool: ${name}` };
  }
}
