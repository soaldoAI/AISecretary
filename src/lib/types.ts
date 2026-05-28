export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

export type Priority = "low" | "medium" | "high" | "urgent";

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

export const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];
