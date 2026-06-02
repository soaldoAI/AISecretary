"use client";

import { useState } from "react";
import { Task, TaskStatus, Priority, COLUMNS } from "@/lib/types";

interface Props {
  task: Task;
  onDragStart: (e: React.DragEvent, taskId: number) => void;
  onClick: () => void;
  onQuickMove?: (newStatus: TaskStatus) => void;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-green-800 border-green-600 hover:bg-green-700",
  medium: "bg-yellow-900 border-yellow-700 hover:bg-yellow-800",
  high: "bg-red-700 border-red-500 hover:bg-red-600",
};

const PRIORITY_BADGES: Record<Priority, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-green-700", text: "text-green-100", label: "Low" },
  medium: { bg: "bg-yellow-800", text: "text-yellow-100", label: "Med" },
  high: { bg: "bg-red-800", text: "text-red-100", label: "High" },
};

export default function TaskCard({ task, onDragStart, onClick, onQuickMove }: Props) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  const color = PRIORITY_COLORS[task.priority];
  const badge = PRIORITY_BADGES[task.priority];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className={"rounded-xl p-3.5 cursor-pointer active:scale-[0.98] transition-all border " + color}
    >
      {/* Priority badge + Title */}
      <div className="flex items-start gap-2.5">
        <span className={"mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 " + badge.bg + " " + badge.text}>
          {badge.label}
        </span>
        <h3 className="text-sm font-medium text-gray-100 leading-snug flex-1">{task.title}</h3>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-400 mt-1.5 ml-[42px] line-clamp-2">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 ml-[42px]">
        <div className="flex items-center gap-3">
          {task.agent ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{task.agent.avatar}</span>
              <span className="text-[11px] text-gray-300 font-medium">{task.agent.name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-500">Unassigned</span>
          )}

          {task.due_date && (
            <span className={"text-[11px] " + (isOverdue ? "text-red-400 font-medium" : "text-gray-400")}>
              {isOverdue ? "⚠ " : ""}
              {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Quick move button (mobile) */}
        {onQuickMove && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
              className="text-gray-500 hover:text-gray-200 p-1 -m-1 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {showMoveMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMoveMenu(false); }} />
                <div className="absolute right-0 bottom-8 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
                  {COLUMNS.filter(c => c.id !== task.status).map((col) => (
                    <button
                      key={col.id}
                      onClick={(e) => { e.stopPropagation(); onQuickMove(col.id); setShowMoveMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700/60 transition-colors"
                    >
                      Move to {col.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
