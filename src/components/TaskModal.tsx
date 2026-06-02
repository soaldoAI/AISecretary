"use client";

import { useState, useEffect } from "react";
import { Task, Agent, COLUMNS, TaskStatus, Priority } from "@/lib/types";

interface Activity {
  id: number;
  task_id: number;
  actor: string;
  action: string;
  detail: string;
  created_at: string;
}

interface Props {
  task: Task | null;
  agents: Agent[];
  activeColumn: TaskStatus;
  onSave: (data: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    assigned_to: number | null;
    due_date: string | null;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "bg-green-400" },
  { value: "medium", label: "Medium", color: "bg-yellow-600" },
  { value: "high", label: "High", color: "bg-red-400" },
];

const ACTOR_STYLES: Record<string, string> = {
  "Sohan": "bg-blue-900/50 text-blue-300 border-blue-800",
  "Co-Pilot": "bg-purple-900/50 text-purple-300 border-purple-800",
};

const ACTOR_ICONS: Record<string, string> = {
  "Sohan": "👔",
  "Co-Pilot": "✨",
};

const ACTION_ICONS: Record<string, string> = {
  created: "➕",
  updated: "✏️",
  moved: "➡️",
  commented: "💬",
  deleted: "❌",
};

export default function TaskModal({ task, agents, activeColumn, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState<TaskStatus>(task?.status || activeColumn);
  const [priority, setPriority] = useState<Priority>(task?.priority || "medium");
  const [assignedTo, setAssignedTo] = useState<number | null>(task?.assigned_to || null);
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"details" | "activity">("details");
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    if (task?.id) {
      fetch(`/api/tasks/${task.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.activity) setActivity(data.activity);
        })
        .catch(() => {});
    }
  }, [task?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description,
      status,
      priority,
      assigned_to: assignedTo,
      due_date: dueDate || null,
    });
  };

  const formatRelative = (iso: string) => {
    const d = new Date(iso + "Z");
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 w-full sm:max-w-xl sm:rounded-xl rounded-t-2xl border-t sm:border border-gray-800 max-h-[90dvh] overflow-y-auto safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-5 py-3 sm:py-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold">
              {task ? `Task #${task.id}` : "New Task"}
            </h2>
            <button
              type="button" onClick={onClose}
              className="text-gray-500 hover:text-white p-1 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Tabs (only show if editing existing task) */}
          {task && (
            <div className="px-5 border-b border-gray-800/60">
              <div className="flex gap-4">
                <button type="button" onClick={() => setTab("details")}
                  className={"py-2 text-sm font-medium border-b-2 transition-colors " +
                    (tab === "details" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300")}>
                  Details
                </button>
                <button type="button" onClick={() => setTab("activity")}
                  className={"py-2 text-sm font-medium border-b-2 transition-colors " +
                    (tab === "activity" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300")}>
                  Activity ({activity.length})
                </button>
              </div>
            </div>
          )}

          {/* Details tab */}
          {tab === "details" && (
            <div className="px-5 pb-4 pt-4 space-y-4">
              <input
                type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-lg sm:text-base font-medium text-white placeholder-gray-600 focus:outline-none border-b border-gray-800 pb-3"
                placeholder="Task title..."
                autoFocus
              />

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                placeholder="Add description..."
              />

              <div>
                <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Priority</label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value} type="button"
                      onClick={() => setPriority(p.value)}
                      className={"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all " +
                        (priority === p.value
                          ? "bg-gray-700 text-white ring-1 ring-gray-600"
                          : "bg-gray-800/60 text-gray-500 hover:text-gray-300")}
                    >
                      <span className={"w-1.5 h-1.5 rounded-full " + p.color} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Status</label>
                  <select value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none">
                    {COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>{col.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Assign To</label>
                  <select value={assignedTo || ""}
                    onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none">
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.avatar} {a.name} ({a.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Due Date</label>
                <input type="date" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
              </div>
            </div>
          )}

          {/* Activity tab */}
          {tab === "activity" && (
            <div className="px-5 pb-4 pt-4">
              {activity.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((a) => (
                    <div key={a.id} className="flex gap-3">
                      {/* Actor icon */}
                      <div className="shrink-0 mt-0.5">
                        <span className="text-sm">{ACTOR_ICONS[a.actor] || "👤"}</span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={"text-[10px] px-1.5 py-0.5 rounded border font-medium " +
                            (ACTOR_STYLES[a.actor] || "bg-gray-800 text-gray-400 border-gray-700")}>
                            {a.actor}
                          </span>
                          <span className="text-xs text-gray-500">
                            {ACTION_ICONS[a.action] || ""} {a.action}
                          </span>
                          <span className="text-[10px] text-gray-600">{formatRelative(a.created_at)}</span>
                        </div>
                        {a.detail && (
                          <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap leading-relaxed">{a.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-4 border-t border-gray-800/60 flex items-center justify-between">
            <div>
              {onDelete && !confirmDelete && (
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors">
                  Delete
                </button>
              )}
              {onDelete && confirmDelete && (
                <button type="button" onClick={onDelete}
                  className="text-red-400 text-xs font-medium animate-pulse">
                  Tap to confirm delete
                </button>
              )}
            </div>
            {tab === "details" && (
              <button type="submit"
                className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {task ? "Save" : "Create"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
