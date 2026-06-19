import type { ChatMessage } from "./types";

const CHARS_PER_TOKEN = 4;
const DEFAULT_TOKEN_BUDGET = 100_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function messageTokens(msg: ChatMessage): number {
  let total = estimateTokens(msg.content || "");
  if (msg.toolCalls) {
    for (const tc of msg.toolCalls) {
      total += estimateTokens(JSON.stringify(tc.arguments));
    }
  }
  return total;
}

interface Exchange {
  start: number;
  end: number;
  tokens: number;
  isUser: boolean;
}

function groupExchanges(messages: ChatMessage[]): Exchange[] {
  const exchanges: Exchange[] = [];
  let i = 0;

  while (i < messages.length) {
    if (messages[i].role === "user") {
      const start = i;
      let tokens = messageTokens(messages[i]);
      i++;
      while (i < messages.length && messages[i].role !== "user") {
        tokens += messageTokens(messages[i]);
        i++;
      }
      exchanges.push({ start, end: i - 1, tokens, isUser: true });
    } else {
      exchanges.push({ start: i, end: i, tokens: messageTokens(messages[i]), isUser: false });
      i++;
    }
  }

  return exchanges;
}

export function trimMessages(
  messages: ChatMessage[],
  _maxExchanges?: number,
  tokenBudget: number = DEFAULT_TOKEN_BUDGET
): ChatMessage[] {
  if (messages.length === 0) return messages;

  const system = messages[0];
  const rest = messages.slice(1);

  if (rest.length === 0) return messages;

  const budget = tokenBudget - messageTokens(system);
  const exchanges = groupExchanges(rest);

  let totalTokens = 0;
  let cutIdx = 0;

  for (let i = exchanges.length - 1; i >= 0; i--) {
    if (totalTokens + exchanges[i].tokens > budget) break;
    totalTokens += exchanges[i].tokens;
    cutIdx = exchanges[i].start;
  }

  const trimmed = rest.slice(cutIdx);

  if (trimmed.length === 0) {
    const lastUser = [...rest].reverse().findIndex(m => m.role === "user");
    if (lastUser !== -1) {
      return [system, rest[rest.length - 1 - lastUser]];
    }
    return messages;
  }

  const hasUser = trimmed.some(m => m.role === "user");
  if (!hasUser) {
    return [system, ...trimmed];
  }

  if (trimmed[0].role !== "user") {
    const firstUser = trimmed.findIndex(m => m.role === "user");
    if (firstUser === -1) return [system];
    return [system, ...trimmed.slice(firstUser)];
  }

  return [system, ...trimmed];
}
