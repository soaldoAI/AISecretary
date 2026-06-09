"use client";

import { Task, TaskStatus } from "@/lib/types";
import TaskCard from "./TaskCard";

interface Column {
  id: TaskStatus;
  label: string;
  icon: string;
}

interface Props {
  tasks: Task[];
  columns: Column[];
  activeColumn: TaskStatus;
  onMoveTask: (taskId: number, newStatus: TaskStatus, newPosition: number) => void;
  onEditTask: (task: Task) => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "border-gray-600",
  todo: "border-amber-500",
  in_progress: "border-blue-500",
  review: "border-purple-500",
  done: "border-emerald-500",
};

const STATUS_BG: Record<TaskStatus, string> = {
  backlog: "bg-gray-600",
  todo: "bg-amber-500",
  in_progress: "bg-blue-500",
  review: "bg-purple-500",
  done: "bg-emerald-500",
};

export default function KanbanBoard({ tasks, columns, activeColumn, onMoveTask, onEditTask }: Props) {
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData("taskId", String(taskId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData("taskId"));
    const columnTasks = tasks.filter((t) => t.status === status);
    onMoveTask(taskId, status, columnTasks.length);
  };

  return (
    <>
      {/* Mobile: single column view */}
      <div className="sm:hidden h-full overflow-y-auto px-4 py-3 pb-24">
        {(() => {
          const columnTasks = tasks
            .filter((t) => t.status === activeColumn)
            .sort((a, b) => a.position - b.position);

          if (columnTasks.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-20 text-subtle">
                <div className="text-4xl mb-3">
                  {activeColumn === "done" ? "🎉" : "📋"}
                </div>
                <p className="text-sm">No tasks in {columns.find(c => c.id === activeColumn)?.label}</p>
              </div>
            );
          }

          return (
            <div className="space-y-2.5">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDragStart={handleDragStart}
                  onClick={() => onEditTask(task)}
                  onQuickMove={(newStatus) => {
                    const targetTasks = tasks.filter(t => t.status === newStatus);
                    onMoveTask(task.id, newStatus, targetTasks.length);
                  }}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Desktop: full board */}
      <div className="hidden sm:flex gap-4 h-full overflow-x-auto p-6">
        {columns.map((col) => {
          const columnTasks = tasks
            .filter((t) => t.status === col.id)
            .sort((a, b) => a.position - b.position);

          return (
            <div
              key={col.id}
              className={`flex-shrink-0 w-72 flex flex-col bg-surface rounded-xl border-t-2 ${STATUS_COLORS[col.id]}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${STATUS_BG[col.id]}`} />
                  <h2 className="font-semibold text-sm text-muted uppercase tracking-wide">
                    {col.label}
                  </h2>
                </div>
                <span className="text-xs bg-surface-muted text-muted px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>

              <div className="px-3 pb-3 space-y-2 flex-1 overflow-y-auto hide-scrollbar">
                {columnTasks.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-subtle text-xs">
                    Drop tasks here
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onDragStart={handleDragStart}
                      onClick={() => onEditTask(task)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
