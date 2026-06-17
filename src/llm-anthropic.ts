import { ChatMessage, ToolDefinition, StreamCallbacks } from "./types";

export async function streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const anthropicTools = tools.length > 0
    ? tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }))
    : undefined;

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");
  const anthropicMessages: object[] = [];

  for (const msg of chatMessages) {
    if (msg.role === "tool") {
      anthropicMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.toolCallId,
            content: msg.content,
          },
        ],
      });
    } else if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      const content: object[] = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      anthropicMessages.push({ role: "assistant", content });
    } else {
      anthropicMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: 8192,
    messages: anthropicMessages,
    stream: true,
  };
  if (systemMsg) body.system = systemMsg.content;
  if (anthropicTools) body.tools = anthropicTools;

  // requestUrl does not support ReadableStream or AbortSignal — fetch() is required for SSE streaming
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  const toolUseBlocks: Map<string, { name: string; args: string }> = new Map();
  let currentBlockId: string | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("event: ")) {
          if (trimmed.slice(7) === "message_stop") {
            callbacks.onDone();
            return;
          }
          continue;
        }

        if (!trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.slice(6);

        try {
          const data = JSON.parse(dataStr);

          if (data.type === "content_block_delta") {
            const delta = data.delta;
            if (delta?.type === "text_delta" && delta.text) {
              callbacks.onToken(delta.text);
            } else if (delta?.type === "input_json_delta" && delta.partial_json) {
              if (currentBlockId && toolUseBlocks.has(currentBlockId)) {
                toolUseBlocks.get(currentBlockId)!.args += delta.partial_json;
              }
            }
          } else if (data.type === "content_block_start") {
            const block = data.content_block;
            if (block?.type === "tool_use") {
              currentBlockId = block.id;
              toolUseBlocks.set(block.id, { name: block.name, args: "" });
            }
          } else if (data.type === "content_block_stop") {
            if (currentBlockId && toolUseBlocks.has(currentBlockId)) {
              const block = toolUseBlocks.get(currentBlockId)!;
              try {
                const parsed = JSON.parse(block.args);
                callbacks.onToolCall(block.name, parsed, currentBlockId);
              } catch {
                callbacks.onToolCall(block.name, {}, currentBlockId);
              }
            }
            currentBlockId = null;
          }
        } catch {
          continue;
        }
      }
    }

    callbacks.onDone();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      callbacks.onDone();
      return;
    }
    callbacks.onError(e instanceof Error ? e.message : String(e));
  } finally {
    reader.releaseLock();
  }
}
