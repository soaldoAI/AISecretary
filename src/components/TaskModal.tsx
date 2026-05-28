"use client";

import { useState } from "react";
import { Task, Agent, COLUMNS, TaskStatus, Priority } from "@/lib/types";

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
  { value: "low", label: "Low", color: "bg-gray-400" },
  { value: "medium", label: "Medium", color: "bg-amber-400" },
  { value: "high", label: "High", color: "bg-orange-400" },
  { value: "urgent", label: "Urgent", color: "bg-red-400" },
];

export default function TaskModal({ task, agents, activeColumn, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState<TaskStatus>(task?.status || activeColumn);
  const [priority, setPriority] = useState<Priority>(task?.priority || "medium");
  const [assignedTo, setAssignedTo] = useState<number | null>(task?.assigned_to || null);
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl border-t sm:border border-gray-800 max-h-[90dvh] overflow-y-auto safe-bottom"
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
              {task ? "Edit Task" : "New Task"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-white p-1 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="px-5 pb-4 space-y-4">
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-lg sm:text-base font-medium text-white placeholder-gray-600 focus:outline-none border-b border-gray-800 pb-3"
              placeholder="Task title..."
              autoFocus
            />

            {/* Description */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
              placeholder="Add description..."
            />

            {/* Priority pills */}
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                      ${priority === p.value
                        ? "bg-gray-700 text-white ring-1 ring-gray-600"
                        : "bg-gray-800/60 text-gray-500 hover:text-gray-300"
                      }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${p.color}`} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status + Agent */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none"
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Assign To</label>
                <select
                  value={assignedTo || ""}
                  onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.avatar} {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-gray-800/60 flex items-center justify-between">
            <div>
              {onDelete && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  Delete
                </button>
              )}
              {onDelete && confirmDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-red-400 text-xs font-medium animate-pulse"
                >
                  Tap to confirm delete
                </button>
              )}
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {task ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
