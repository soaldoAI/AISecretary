import { copilotTools, executeTool, ToolDefinition, ToolResult } from "./tools";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function getProviderConfig(provider?: string, model?: string): ProviderConfig {
  const resolvedProvider = provider || process.env.COPILOT_DEFAULT_PROVIDER || "openrouter";

  if (resolvedProvider === "ollama") {
    return {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1",
      apiKey: "ollama",
      model: model || process.env.COPILOT_DEFAULT_MODEL || "llama3.2:3b",
    };
  }

  return {
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: model || process.env.COPILOT_DEFAULT_MODEL || "gpt-4o-mini",
  };
}

export interface StreamEvent {
  type: "delta" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolResult;
}

export async function* streamChatWithTools(
  messages: ChatMessage[],
  provider?: string,
  model?: string,
  maxToolRounds: number = 5
): AsyncGenerator<StreamEvent> {
  const config = getProviderConfig(provider, model);

  if (!config.apiKey) {
    yield { type: "error", content: "No API key configured. Set OPENROUTER_API_KEY in .env" };
    return;
  }

  const currentMessages = [...messages];
  let toolRound = 0;

  while (toolRound < maxToolRounds) {
    const response = await callLLM(config, currentMessages, copilotTools);

    if (response.error) {
      yield { type: "error", content: response.error };
      return;
    }

    // If no tool calls, stream the content
    if (!response.toolCalls || response.toolCalls.length === 0) {
      if (response.content) {
        yield { type: "delta", content: response.content };
      }
      yield { type: "done" };
      return;
    }

    // Process tool calls
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: response.content || null,
      tool_calls: response.toolCalls,
    };
    currentMessages.push(assistantMsg);

    if (response.content) {
      yield { type: "delta", content: response.content };
    }

    for (const tc of response.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      yield { type: "tool_call", toolName: tc.function.name, toolArgs: args };

      const result = executeTool(tc.function.name, args);
      yield { type: "tool_result", toolName: tc.function.name, toolResult: result };

      currentMessages.push({
        role: "tool",
        content: JSON.stringify(result),
        tool_call_id: tc.id,
      });
    }

    toolRound++;
  }

  yield { type: "done" };
}

interface LLMResponse {
  content?: string;
  toolCalls?: ToolCall[];
  error?: string;
}

async function callLLM(
  config: ProviderConfig,
  messages: ChatMessage[],
  tools: ToolDefinition[]
): Promise<LLMResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools,
        tool_choice: "auto",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) {
        return { error: "Rate limited. Try again shortly." };
      }
      return { error: `LLM error (${res.status}): ${body}` };
    }

    const data = await res.json();
    const choice = data.choices?.[0];

    if (!choice) return { error: "No response from LLM" };

    return {
      content: choice.message?.content || undefined,
      toolCalls: choice.message?.tool_calls || undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Keep the old streaming interface for backwards compatibility if needed
export async function* streamChat(
  messages: ChatMessage[],
  provider?: string,
  model?: string
): AsyncGenerator<string> {
  for await (const event of streamChatWithTools(messages, provider, model)) {
    if (event.type === "delta" && event.content) {
      yield event.content;
    } else if (event.type === "error") {
      throw new Error(event.content);
    }
  }
}
