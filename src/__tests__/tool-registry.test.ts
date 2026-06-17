import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("obsidian", () => ({
  TFile: class {},
  TFolder: class {},
  normalizePath: (p: string) => p,
  requestUrl: vi.fn(),
}));

describe("tool-registry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("registers and retrieves tool definitions", async () => {
    const { registerTool, getToolDefinitions } = await import("../tool-registry");

    registerTool(
      {
        name: "test_tool",
        description: "A test tool",
        parameters: {
          type: "object",
          properties: { x: { type: "string", description: "param" } },
          required: ["x"],
        },
      },
      async (_app, args) => JSON.stringify(args)
    );

    const defs = getToolDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe("test_tool");
    expect(defs[0].description).toBe("A test tool");
  });

  it("executes a registered tool and returns string result", async () => {
    const { registerTool, executeTool } = await import("../tool-registry");

    registerTool(
      {
        name: "echo",
        description: "Echo",
        parameters: {
          type: "object",
          properties: { msg: { type: "string", description: "msg" } },
          required: ["msg"],
        },
      },
      async (_app, args) => `Echo: ${args.msg}`
    );

    const result = await executeTool({} as any, "echo", { msg: "hello" });
    expect(result).toBe("Echo: hello");
  });

  it("returns error for unknown tool", async () => {
    const { executeTool } = await import("../tool-registry");

    const result = await executeTool({} as any, "nonexistent", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Unknown tool");
  });

  it("returns error when handler throws", async () => {
    const { registerTool, executeTool } = await import("../tool-registry");

    registerTool(
      {
        name: "failing",
        description: "Fails",
        parameters: { type: "object", properties: {}, required: [] },
      },
      async () => { throw new Error("boom"); }
    );

    const result = await executeTool({} as any, "failing", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("boom");
  });
});
