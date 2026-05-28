"use client";

import { Task, TaskStatus } from "@/lib/types";
import TaskCard from "./TaskCard";

interface Column {
  id: TaskStatus;
  label: string;
}

interface Props {
  tasks: Task[];
  columns: Column[];
  onMoveTask: (taskId: number, newStatus: TaskStatus, newPosition: number) => void;
  onEditTask: (task: Task) => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "border-gray-600",
  todo: "border-yellow-500",
  in_progress: "border-blue-500",
  review: "border-purple-500",
  done: "border-green-500",
};

export default function KanbanBoard({ tasks, columns, onMoveTask, onEditTask }: Props) {
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
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const columnTasks = tasks
          .filter((t) => t.status === col.id)
          .sort((a, b) => a.position - b.position);

        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-72 bg-gray-900 rounded-xl border-t-2 ${STATUS_COLORS[col.id]}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-gray-300 uppercase tracking-wide">
                {col.label}
              </h2>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {columnTasks.length}
              </span>
            </div>

            <div className="px-3 pb-3 space-y-2 min-h-[200px]">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDragStart={handleDragStart}
                  onClick={() => onEditTask(task)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
