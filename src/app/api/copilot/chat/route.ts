import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { buildCopilotContext } from "@/lib/copilot/context";
import { streamChatWithTools, ChatMessage } from "@/lib/copilot/llm";

export async function POST(req: Request) {
  let body: { conversationId?: number; message?: string; provider?: string; model?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, provider, model } = body;
  let { conversationId } = body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const db = getDb();
  const trimmedMessage = message.trim();

  // Create conversation if needed
  if (!conversationId) {
    const title = trimmedMessage.slice(0, 80) + (trimmedMessage.length > 80 ? "..." : "");
    const result = db
      .prepare("INSERT INTO conversations (title) VALUES (?)")
      .run(title);
    conversationId = result.lastInsertRowid as number;
  } else {
    const conv = db
      .prepare("SELECT id FROM conversations WHERE id = ?")
      .get(conversationId);
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
  }

  // Save user message
  db.prepare(
    "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)"
  ).run(conversationId, trimmedMessage);

  // Load conversation history (last 10 turns)
  const history = db
    .prepare(
      `SELECT role, content FROM messages
       WHERE conversation_id = ? AND role IN ('user', 'assistant')
       ORDER BY id DESC LIMIT 10`
    )
    .all(conversationId) as { role: string; content: string }[];
  history.reverse();

  // Build context
  const { systemPrompt } = buildCopilotContext();

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Stream response with tool calling
  const encoder = new TextEncoder();
  let fullResponse = "";
  const actions: { tool: string; args: Record<string, unknown>; result: unknown }[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamChatWithTools(messages, provider, model)) {
          switch (event.type) {
            case "delta":
              fullResponse += event.content || "";
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ delta: event.content })}\n\n`)
              );
              break;
            case "tool_call":
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ action: { tool: event.toolName, args: event.toolArgs } })}\n\n`)
              );
              break;
            case "tool_result":
              actions.push({ tool: event.toolName!, args: event.toolArgs || {}, result: event.toolResult });
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ actionResult: event.toolResult })}\n\n`)
              );
              break;
            case "error":
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: event.content })}\n\n`)
              );
              break;
            case "done":
              break;
          }
        }

        // Save assistant message with actions metadata
        const meta = {
          provider: provider || "openai",
          model: model || "default",
          actions: actions.length > 0 ? actions : undefined,
        };
        db.prepare(
          "INSERT INTO messages (conversation_id, role, content, meta) VALUES (?, 'assistant', ?, ?)"
        ).run(conversationId, fullResponse, JSON.stringify(meta));

        db.prepare(
          "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
        ).run(conversationId);

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, conversationId, actions })}\n\n`)
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
