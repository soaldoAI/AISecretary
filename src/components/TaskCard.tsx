"use client";

import { Task, Priority } from "@/lib/types";

interface Props {
  task: Task;
  onDragStart: (e: React.DragEvent, taskId: number) => void;
  onClick: () => void;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-gray-700 text-gray-300",
  medium: "bg-yellow-900 text-yellow-300",
  high: "bg-orange-900 text-orange-300",
  urgent: "bg-red-900 text-red-300",
};

export default function TaskCard({ task, onDragStart, onClick }: Props) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-750 hover:ring-1 hover:ring-gray-600 transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-white leading-snug">{task.title}</h3>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_STYLES[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between mt-3">
        {task.agent ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{task.agent.avatar}</span>
            <span className="text-xs text-gray-400">{task.agent.name}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-600">Unassigned</span>
        )}

        {task.due_date && (
          <span className={`text-xs ${isOverdue ? "text-red-400" : "text-gray-500"}`}>
            {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
    </div>
  );
}
