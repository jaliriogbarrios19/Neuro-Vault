import type { ChatMessage } from "./types";

export function trimMessages(
  messages: ChatMessage[],
  maxExchanges: number
): ChatMessage[] {
  if (messages.length === 0) return messages;
  let userCount = 0;
  let cutIndex = 1;
  for (let i = messages.length - 1; i >= 1; i--) {
    if (messages[i].role === "user") {
      userCount++;
      if (userCount >= maxExchanges) { cutIndex = i; break; }
    }
  }
  if (cutIndex > 1) {
    return [messages[0], ...messages.slice(cutIndex)];
  }
  return messages;
}
