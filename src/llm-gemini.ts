import { ChatMessage, ToolDefinition, StreamCallbacks } from "./types";

export async function streamGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const { systemInstruction, contents } = convertToGeminiMessages(messages);
  const geminiTools = convertToGeminiTools(tools);

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (geminiTools) {
    body.tools = [{ functionDeclarations: geminiTools }];
  }

  // requestUrl does not support ReadableStream or AbortSignal — fetch() is required for SSE streaming
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let textContent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        try {
          const data = JSON.parse(trimmed.slice(6));
          const candidate = data.candidates?.[0];
          if (!candidate) continue;

          const parts: any[] = candidate.content?.parts ?? [];
          for (const part of parts) {
            if (part.text) {
              const newText = part.text as string;
              if (newText.startsWith(textContent)) {
                const delta = newText.slice(textContent.length);
                if (delta) callbacks.onToken(delta);
              } else {
                callbacks.onToken(newText);
              }
              textContent = newText;
            }

            if (part.functionCall) {
              const fc = part.functionCall;
              const id = `gc-${fc.name ?? "fn"}-${Date.now()}`;
              callbacks.onToolCall(fc.name ?? "unknown", fc.args ?? {}, id);
            }
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

function convertToGeminiMessages(messages: ChatMessage[]): {
  systemInstruction: string;
  contents: object[];
} {
  let systemInstruction = "";
  const contents: object[] = [];
  const toolCallNameMap = new Map<string, string>();

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = msg.content;
      continue;
    }

    if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content }] });
      continue;
    }

    if (msg.role === "assistant") {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          toolCallNameMap.set(tc.id, tc.name);
        }
        const parts: object[] = [];
        if (msg.content) parts.push({ text: msg.content });
        for (const tc of msg.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
        }
        contents.push({ role: "model", parts });
      } else {
        contents.push({ role: "model", parts: [{ text: msg.content }] });
      }
      continue;
    }

    if (msg.role === "tool") {
      const toolName = msg.toolCallId
        ? toolCallNameMap.get(msg.toolCallId) ?? "unknown"
        : "unknown";
      let response: unknown;
      try {
        response = JSON.parse(msg.content);
      } catch {
        response = { result: msg.content };
      }
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: toolName, response } }],
      });
      continue;
    }
  }

  return { systemInstruction, contents };
}

function convertToGeminiTools(
  tools: ToolDefinition[]
): object[] | undefined {
  if (tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
