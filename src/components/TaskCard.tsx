"use client";

import { useState } from "react";
import { Task, TaskStatus, Priority, COLUMNS } from "@/lib/types";

interface Props {
  task: Task;
  onDragStart: (e: React.DragEvent, taskId: number) => void;
  onClick: () => void;
  onQuickMove?: (newStatus: TaskStatus) => void;
}

const PRIORITY_STYLES: Record<Priority, { bg: string; dot: string }> = {
  low: { bg: "bg-gray-800", dot: "bg-gray-400" },
  medium: { bg: "bg-amber-950/40", dot: "bg-amber-400" },
  high: { bg: "bg-orange-950/40", dot: "bg-orange-400" },
  urgent: { bg: "bg-red-950/40", dot: "bg-red-400" },
};

export default function TaskCard({ task, onDragStart, onClick, onQuickMove }: Props) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  const pStyle = PRIORITY_STYLES[task.priority];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-3.5 cursor-pointer hover:bg-gray-800 active:scale-[0.98] transition-all border border-gray-700/30"
    >
      {/* Priority + Title */}
      <div className="flex items-start gap-2.5">
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${pStyle.dot}`} />
        <h3 className="text-sm font-medium text-gray-100 leading-snug flex-1">{task.title}</h3>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 mt-1.5 ml-[18px] line-clamp-2">{task.description}</p>
      )}

      {/* Footer: Agent + Due date + Quick move */}
      <div className="flex items-center justify-between mt-3 ml-[18px]">
        <div className="flex items-center gap-3">
          {task.agent ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{task.agent.avatar}</span>
              <span className="text-[11px] text-gray-400 font-medium">{task.agent.name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-600">Unassigned</span>
          )}

          {task.due_date && (
            <span className={`text-[11px] ${isOverdue ? "text-red-400 font-medium" : "text-gray-500"}`}>
              {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Quick move button (mobile only) */}
        {onQuickMove && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMoveMenu(!showMoveMenu);
              }}
              className="text-gray-600 hover:text-gray-300 p-1 -m-1 transition-colors"
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickMove(col.id);
                        setShowMoveMenu(false);
                      }}
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
