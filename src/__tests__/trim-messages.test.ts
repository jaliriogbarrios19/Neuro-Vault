import { describe, it, expect } from "vitest";
import { trimMessages } from "../trim-messages";
import type { ChatMessage } from "../types";

function msg(role: ChatMessage["role"], content: string): ChatMessage {
  return { role, content };
}

describe("trimMessages", () => {
  it("keeps all messages when under budget", () => {
    const messages: ChatMessage[] = [
      msg("system", "You are helpful"),
      msg("user", "Hello"),
      msg("assistant", "Hi!"),
    ];
    const result = trimMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe("system");
  });

  it("trims old exchanges keeping system prompt and last user", () => {
    const messages: ChatMessage[] = [
      msg("system", "You are helpful"),
      msg("user", "Q1"),
      msg("assistant", "A1"),
      msg("user", "Q2"),
      msg("assistant", "A2"),
      msg("user", "Q3"),
      msg("assistant", "A3"),
    ];
    const result = trimMessages(messages, undefined, 200);
    expect(result[0].role).toBe("system");
    expect(result[result.length - 1].role).toBe("assistant");
    expect(result.some(m => m.content === "Q3")).toBe(true);
  });

  it("always keeps the last user message even if alone", () => {
    const bigContent = "x".repeat(50000);
    const messages: ChatMessage[] = [
      msg("system", "prompt"),
      msg("user", "Q1"),
      msg("assistant", bigContent),
      msg("user", "Q2"),
      msg("assistant", "A2"),
    ];
    const result = trimMessages(messages, undefined, 1000);
    expect(result.some(m => m.content === "Q2")).toBe(true);
    expect(result[result.length - 1].content).toBe("A2");
  });

  it("preserves tool-call chains without orphans", () => {
    const messages: ChatMessage[] = [
      msg("system", "You are helpful"),
      msg("user", "Search something"),
      msg("assistant", "Let me search"),
      msg("tool", "search result data"),
      msg("assistant", "Found it"),
      msg("user", "Q2"),
      msg("assistant", "A2"),
    ];
    const result = trimMessages(messages, undefined, 500);
    expect(result[0].role).toBe("system");
    if (result.some(m => m.role === "tool")) {
      const toolIdx = result.findIndex(m => m.role === "tool");
      expect(result[toolIdx - 1].role).toBe("assistant");
    }
  });

  it("drops large tool results first when over budget", () => {
    const bigResult = "x".repeat(40000);
    const messages: ChatMessage[] = [
      msg("system", "prompt"),
      msg("user", "read file"),
      msg("assistant", "reading..."),
      { role: "tool", content: bigResult, toolCallId: "tc1" },
      msg("assistant", "Here is the summary"),
      msg("user", "thanks"),
      msg("assistant", "you're welcome"),
    ];
    const result = trimMessages(messages, undefined, 3000);
    expect(result[0].role).toBe("system");
    expect(result.some(m => m.content === "thanks")).toBe(true);
  });

  it("handles empty array", () => {
    expect(trimMessages([])).toHaveLength(0);
  });

  it("handles system-only messages", () => {
    const result = trimMessages([msg("system", "prompt")]);
    expect(result).toHaveLength(1);
  });

  it("handles messages with no user messages", () => {
    const messages: ChatMessage[] = [
      msg("system", "prompt"),
      msg("assistant", "response"),
    ];
    const result = trimMessages(messages);
    expect(result).toHaveLength(2);
  });

  it("uses default 100K token budget when not specified", () => {
    const messages: ChatMessage[] = [
      msg("system", "prompt"),
      msg("user", "Q1"),
      msg("assistant", "A1"),
      msg("user", "Q2"),
      msg("assistant", "A2"),
    ];
    const result = trimMessages(messages);
    expect(result).toHaveLength(5);
  });
});
