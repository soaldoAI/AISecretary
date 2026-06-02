export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

export type Priority = "low" | "medium" | "high";

export interface Agent {
  id: number;
  name: string;
  role: string;
  avatar: string;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigned_to: number | null;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  agent?: Agent;
}

export const COLUMNS: { id: TaskStatus; label: string; icon: string }[] = [
  { id: "backlog", label: "Backlog", icon: "inbox" },
  { id: "todo", label: "To Do", icon: "list" },
  { id: "in_progress", label: "Active", icon: "zap" },
  { id: "review", label: "Review", icon: "eye" },
  { id: "done", label: "Done", icon: "check" },
];
