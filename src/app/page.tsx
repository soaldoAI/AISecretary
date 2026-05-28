"use client";

import { useEffect, useState, useCallback } from "react";
import { Task, Agent, COLUMNS, TaskStatus, Priority } from "@/lib/types";
import KanbanBoard from "@/components/KanbanBoard";
import TaskModal from "@/components/TaskModal";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
  };

  const handleDeleteTask = async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await fetchTasks();
    setEditingTask(null);
  };

  const handleMoveTask = async (taskId: number, newStatus: TaskStatus, newPosition: number) => {
    // Optimistic update
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AerialIQ Kanban</h1>
          <p className="text-sm text-gray-400 mt-1">Agent-Driven Task Management</p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Task
        </button>
      </header>

      <main className="p-6">
        <KanbanBoard
          tasks={tasks}
          columns={COLUMNS}
          onMoveTask={handleMoveTask}
          onEditTask={(task) => {
            setEditingTask(task);
            setModalOpen(true);
          }}
        />
      </main>

      {modalOpen && (
        <TaskModal
          task={editingTask}
          agents={agents}
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
    </div>
  );
}
