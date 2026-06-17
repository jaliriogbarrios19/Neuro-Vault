import { describe, it, expect } from "vitest";
import { trimMessages } from "../trim-messages";
import type { ChatMessage } from "../types";

function msg(role: ChatMessage["role"], content: string): ChatMessage {
  return { role, content };
}

describe("trimMessages", () => {
  it("keeps all messages when under limit", () => {
    const messages: ChatMessage[] = [
      msg("system", "You are helpful"),
      msg("user", "Hello"),
      msg("assistant", "Hi!"),
    ];
    const result = trimMessages(messages, 5);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe("system");
  });

  it("trims old exchanges keeping system prompt", () => {
    const messages: ChatMessage[] = [
      msg("system", "You are helpful"),
      msg("user", "Q1"),
      msg("assistant", "A1"),
      msg("user", "Q2"),
      msg("assistant", "A2"),
      msg("user", "Q3"),
      msg("assistant", "A3"),
      msg("user", "Q4"),
      msg("assistant", "A4"),
      msg("user", "Q5"),
      msg("assistant", "A5"),
    ];
    const result = trimMessages(messages, 3);
    expect(result[0].role).toBe("system");
    expect(result[1].role).toBe("user");
    expect(result[1].content).toBe("Q3");
    expect(result).toHaveLength(7); // system + 3 exchanges (Q3..A5)
  });

  it("preserves tool call chains within an exchange", () => {
    const messages: ChatMessage[] = [
      msg("system", "You are helpful"),
      msg("user", "Search something"),
      msg("assistant", "Let me search"),
      msg("tool", "some result"),
      msg("assistant", "Found it"),
      msg("user", "Q2"),
      msg("assistant", "A2"),
      msg("user", "Q3"),
      msg("assistant", "A3"),
      msg("user", "Q4"),
      msg("assistant", "A4"),
    ];
    const result = trimMessages(messages, 2);
    expect(result[1].role).toBe("user");
    expect(result[1].content).toBe("Q3");
    // Q3, A3, Q4, A4 = 4 messages + system = 5
    expect(result).toHaveLength(5);
  });

  it("handles empty array", () => {
    expect(trimMessages([], 5)).toHaveLength(0);
  });

  it("does not trim when no user messages", () => {
    const messages: ChatMessage[] = [
      msg("system", "prompt"),
      msg("assistant", "response"),
    ];
    const result = trimMessages(messages, 1);
    expect(result).toHaveLength(2);
  });
});
