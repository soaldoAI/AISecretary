"use client";

import { useEffect, useState, useCallback } from "react";
import { Task, Agent, COLUMNS, TaskStatus, Priority } from "@/lib/types";
import KanbanBoard from "@/components/KanbanBoard";
import TaskModal from "@/components/TaskModal";
import CopilotPanel from "@/components/CopilotPanel";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskStatus>("todo");

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data);
  }, []);

  const fetchAgents = useCallback(async () => {
    const res = await fetch("/api/agents");
    const data = await res.json();
    setAgents(data);
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  useEffect(() => {
    fetchTasks();
    fetchAgents();
  }, [fetchTasks, fetchAgents]);

  const handleCreateTask = async (task: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    assigned_to: number | null;
    due_date: string | null;
  }) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    await fetchTasks();
    setModalOpen(false);
  };

  const handleUpdateTask = async (id: number, updates: Partial<Task>) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await fetchTasks();
    setEditingTask(null);
    setModalOpen(false);
  };

  const handleDeleteTask = async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await fetchTasks();
    setEditingTask(null);
    setModalOpen(false);
  };

  const handleMoveTask = async (taskId: number, newStatus: TaskStatus, newPosition: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t))
    );
    await fetch("/api/tasks/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, newStatus, newPosition }),
    });
    await fetchTasks();
  };

  const taskCounts = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  return (
    <>
      {/* Header */}
      <header className="shrink-0 border-b border-theme-soft px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Board</h1>
            <p className="text-[11px] sm:text-sm text-muted">Agent-Driven Tasks</p>
          </div>
          <button
            onClick={() => {
              setEditingTask(null);
              setModalOpen(true);
            }}
            className="hidden sm:block bg-accent hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            + New Task
          </button>
        </div>
      </header>

      {/* Column Tabs (mobile) */}
      <nav className="shrink-0 border-b border-theme-soft sm:hidden">
        <div className="flex hide-scrollbar overflow-x-auto">
          {COLUMNS.map((col) => (
            <button
              key={col.id}
              onClick={() => setActiveColumn(col.id)}
              className={"flex-1 min-w-0 px-1 py-2.5 text-center text-xs font-medium transition-colors relative " +
                (activeColumn === col.id ? "text-app" : "text-muted")}
            >
              <span className="block truncate">{col.label}</span>
              {taskCounts[col.id] > 0 && (
                <span className={"inline-block mt-0.5 text-[10px] min-w-[18px] px-1 py-px rounded-full " +
                  (activeColumn === col.id ? "bg-accent text-white" : "bg-surface-muted text-muted")}>
                  {taskCounts[col.id]}
                </span>
              )}
              {activeColumn === col.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Board */}
      <main className="flex-1 overflow-hidden">
        <KanbanBoard
          tasks={tasks}
          columns={COLUMNS}
          activeColumn={activeColumn}
          onMoveTask={handleMoveTask}
          onEditTask={(task) => {
            setEditingTask(task);
            setModalOpen(true);
          }}
        />
      </main>

      {/* Mobile FAB */}
      <button
        onClick={() => {
          setEditingTask(null);
          setModalOpen(true);
        }}
        className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-accent hover:bg-blue-500 rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center text-2xl font-light transition-transform active:scale-95 z-40"
      >
        +
      </button>

      <CopilotPanel onBoardUpdate={fetchTasks} />

      {modalOpen && (
        <TaskModal
          task={editingTask}
          agents={agents}
          activeColumn={activeColumn}
          onSave={
            editingTask
              ? (updates) => handleUpdateTask(editingTask.id, updates)
              : handleCreateTask
          }
          onDelete={editingTask ? () => handleDeleteTask(editingTask.id) : undefined}
          onClose={() => {
            setModalOpen(false);
            setEditingTask(null);
          }}
        />
      )}
    </>
  );
}
