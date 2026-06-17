import { App } from "obsidian";
import { registerTool } from "../tool-registry";

registerTool(
  {
    name: "echo",
    description: "Echo back the input. Useful for testing tool dispatch.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to echo" },
      },
      required: ["message"],
    },
  },
  async (_app, args) => {
    const msg = String(args.message ?? "");
    return `Echo: ${msg}`;
  }
);
