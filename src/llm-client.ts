import { requestUrl } from "obsidian";
import { ChatMessage, ToolDefinition, StreamCallbacks, LLMProvider } from "./types";
import { getSpobBaseUrl } from "./settings";
import { streamAnthropic } from "./llm-anthropic";
import { streamGemini } from "./llm-gemini";

export async function callLLM(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  if (provider === "anthropic") {
    return callAnthropicNonStreaming(apiKey, model, prompt);
  }
  if (provider === "gemini") {
    return callGeminiNonStreaming(apiKey, model, prompt);
  }
  return callOpenAICompatNonStreaming(provider, apiKey, model, prompt);
}

async function callOpenAICompatNonStreaming(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const baseUrl = provider === "spob" ? getSpobBaseUrl() : OPENAI_BASE_URLS[provider];
  if (!baseUrl) throw new Error(`Unknown provider: ${provider}`);

  const res = await requestUrl({
    url: `${baseUrl}/v1/chat/completions`,
    method: "POST",
    headers: OPENAI_HEADERS(apiKey, provider),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (res.status >= 400) {
    const err = res.text.slice(0, 200);
    throw new Error(`${provider} HTTP ${res.status}: ${err}`);
  }
  const data = res.json;
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropicNonStreaming(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await requestUrl({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (res.status >= 400) {
    const err = (res.text ?? "").slice(0, 200);
    throw new Error(`Anthropic HTTP ${res.status}: ${err}`);
  }
  const data = res.json;
  return data.content?.[0]?.text ?? "";
}

async function callGeminiNonStreaming(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await requestUrl({
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (res.status >= 400) {
    const err = (res.text ?? "").slice(0, 200);
    throw new Error(`Gemini HTTP ${res.status}: ${err}`);
  }
  const data = res.json;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

const OPENAI_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com",
  deepseek: "https://api.deepseek.com",
  openrouter: "https://openrouter.ai/api",
  grok: "https://api.x.ai",
  glm: "https://api.z.ai",
};

const OPENAI_HEADERS = (apiKey: string, provider: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://obsidian.md";
    headers["X-Title"] = "Neuro Vault";
  }
  return headers;
};

export async function streamChat(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  if (provider === "anthropic") {
    return streamAnthropic(apiKey, model, messages, tools, callbacks, signal);
  }
  if (provider === "gemini") {
    return streamGemini(apiKey, model, messages, tools, callbacks, signal);
  }
  const baseUrl = provider === "spob" ? getSpobBaseUrl() : OPENAI_BASE_URLS[provider];
  if (!baseUrl) throw new Error(`Unknown provider: ${provider}`);
  return streamOpenAICompat(baseUrl, provider, apiKey, model, messages, tools, callbacks, signal);
}



async function streamOpenAICompat(
  baseUrl: string,
  provider: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const openaiTools = tools.length > 0
    ? tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }))
    : undefined;

  const openaiMessages: object[] = [];

  for (const msg of messages) {
    if (msg.role === "tool") {
      openaiMessages.push({
        role: "tool",
        tool_call_id: msg.toolCallId,
        content: msg.content,
      });
    } else if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      openaiMessages.push({
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      });
    } else {
      openaiMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  const body: Record<string, unknown> = {
    model,
    messages: openaiMessages,
    stream: true,
    max_tokens: 8192,
  };
  if (openaiTools) body.tools = openaiTools;

  // requestUrl does not support ReadableStream or AbortSignal — fetch() is required for SSE streaming
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: OPENAI_HEADERS(apiKey, provider),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`${provider} HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
  let finishedToolCalls = false;

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
        const dataStr = trimmed.slice(6);
        if (dataStr === "[DONE]") {
          finishedToolCalls = true;
          for (const [, tc] of toolCalls) {
            try {
              const parsed = JSON.parse(tc.args);
              callbacks.onToolCall(tc.name, parsed, tc.id);
            } catch {
              callbacks.onToolCall(tc.name, {}, tc.id);
            }
          }
          callbacks.onDone();
          return;
        }

        try {
          const data = JSON.parse(dataStr);
          const delta = data.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            callbacks.onToken(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id ?? "", name: "", args: "" });
              }
              const entry = toolCalls.get(idx)!;
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name = tc.function.name;
              if (tc.function?.arguments) entry.args += tc.function.arguments;
            }
          }
        } catch {
          continue;
        }
      }
    }

    for (const [, tc] of toolCalls) {
      try {
        const parsed = JSON.parse(tc.args);
        callbacks.onToolCall(tc.name, parsed, tc.id);
      } catch {
        callbacks.onToolCall(tc.name, {}, tc.id);
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


