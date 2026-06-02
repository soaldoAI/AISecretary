"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ActionEvent {
  tool: string;
  args: Record<string, unknown>;
  result?: { success: boolean; message: string };
}

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  actions?: ActionEvent[];
}

interface Conversation {
  id: number;
  title: string;
  updated_at: string;
}

export default function CopilotPanel({ onBoardUpdate }: { onBoardUpdate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/copilot/conversations");
    const data = await res.json();
    setConversations(data);
  }, []);

  const loadConversation = async (id: number) => {
    const res = await fetch(`/api/copilot/conversations/${id}`);
    const data = await res.json();
    setConversationId(id);
    setMessages(
      data.messages
        .filter((m: Message) => m.role === "user" || m.role === "assistant")
        .map((m: Message) => ({ role: m.role, content: m.content }))
    );
    setView("chat");
  };

  const deleteConversation = async (id: number) => {
    await fetch(`/api/copilot/conversations/${id}`, { method: "DELETE" });
    if (conversationId === id) {
      setConversationId(null);
      setMessages([]);
    }
    fetchConversations();
  };

  const newChat = () => {
    setConversationId(null);
    setMessages([]);
    setView("chat");
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "", actions: [] }]);

    let boardChanged = false;

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: userMessage }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.delta) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + data.delta };
                }
                return updated;
              });
            }

            if (data.actionResult) {
              boardChanged = true;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  const actions = [...(last.actions || [])];
                  actions.push({ tool: data.actionResult.message, args: {}, result: data.actionResult });
                  updated[updated.length - 1] = { ...last, actions };
                }
                return updated;
              });
            }

            if (data.conversationId && !conversationId) {
              setConversationId(data.conversationId);
            }

            if (data.error) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: `Error: ${data.error}` };
                }
                return updated;
              });
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: `Error: ${err instanceof Error ? err.message : "Connection failed"}`,
          };
        }
        return updated;
      });
    } finally {
      setLoading(false);
      if (boardChanged && onBoardUpdate) {
        onBoardUpdate();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toolIcon = (msg: string) => {
    if (msg.includes("Created")) return "\u2795";
    if (msg.includes("Moved")) return "\u27A1\uFE0F";
    if (msg.includes("Updated")) return "\u270F\uFE0F";
    if (msg.includes("Deleted")) return "\u274C";
    return "\u2699\uFE0F";
  };

  return (
    <>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) fetchConversations();
        }}
        className={"fixed bottom-6 right-20 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center text-xl transition-all z-50 " +
          (open
            ? "bg-gray-700 hover:bg-gray-600"
            : "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30")}
        title="Co-Pilot"
      >
        {open ? "\u2715" : "\u2728"}
      </button>

      {open && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[600px] bg-gray-900 sm:rounded-2xl border border-gray-800 shadow-2xl flex flex-col z-40 sm:max-h-[80vh]">
          <div className="shrink-0 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 text-lg">\u2728</span>
              <h2 className="font-semibold text-sm">Co-Pilot</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-800">actions</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setView(view === "history" ? "chat" : "history");
                  if (view === "chat") fetchConversations();
                }}
                className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
              >
                {view === "history" ? "Chat" : "History"}
              </button>
              <button
                onClick={newChat}
                className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
              >
                New
              </button>
            </div>
          </div>

          {view === "history" ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-10">No conversations yet</p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={"flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm hover:bg-gray-800 " +
                      (conversationId === conv.id ? "bg-gray-800 text-white" : "text-gray-400")}
                  >
                    <span className="truncate flex-1" onClick={() => loadConversation(conv.id)}>
                      {conv.title}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="text-gray-600 hover:text-red-400 ml-2 text-xs"
                    >
                      \u2715
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-600">
                    <span className="text-3xl mb-2">\u2728</span>
                    <p className="text-sm">I can manage your board</p>
                    <p className="text-xs mt-1 text-gray-700">"Create a task for Nova to draft a blog post"</p>
                    <p className="text-xs text-gray-700">"Move task #5 to done"</p>
                    <p className="text-xs text-gray-700">"What's overdue?"</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={"flex flex-col " + (msg.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={"max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap " +
                        (msg.role === "user"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-800 text-gray-200")}
                    >
                      {msg.content || (loading && msg.role === "assistant" ? "\u2588" : "")}
                    </div>
                    {/* Action badges */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 max-w-[85%]">
                        {msg.actions.map((action, j) => (
                          <span
                            key={j}
                            className={"inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full " +
                              (action.result?.success
                                ? "bg-green-900/40 text-green-300 border border-green-800"
                                : "bg-red-900/40 text-red-300 border border-red-800")}
                          >
                            {toolIcon(action.result?.message || "")} {action.result?.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 border-t border-gray-800 p-3">
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask or command Co-Pilot..."
                    rows={1}
                    className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-600"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white px-3 rounded-lg text-sm font-medium transition-colors"
                  >
                    {loading ? "..." : "\u2191"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
