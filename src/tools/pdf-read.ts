import { App, TFile, normalizePath } from "obsidian";
import { registerTool } from "../tool-registry";

registerTool(
  {
    name: "read_pdf",
    description: "Extract text content from a PDF file in the vault",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to PDF file in the vault",
        },
      },
      required: ["path"],
    },
  },
  async (app, args) => {
    const rawPath = String(args.path ?? "").trim();
    if (!rawPath) return JSON.stringify({ error: "Missing path" });

    const normalized = normalizePath(rawPath);
    const file = app.vault.getAbstractFileByPath(normalized);
    if (!file || !(file instanceof TFile)) {
      return JSON.stringify({ error: `File not found: ${normalized}` });
    }

    if (!file.extension.toLowerCase().match(/^pdf$/)) {
      return JSON.stringify({ error: `Not a PDF file: ${normalized}` });
    }

    try {
      const arrayBuffer = await app.vault.readBinary(file);
      const text = extractPdfText(arrayBuffer);
      const truncated = text.length > 12000
        ? text.slice(0, 12000) + "\n...(truncated)"
        : text;
      return JSON.stringify({
        path: file.path,
        text: truncated,
        size: arrayBuffer.byteLength,
      });
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
    }
  }
);

function extractPdfText(buffer: ArrayBuffer): string {
  const raw = new TextDecoder("latin1").decode(buffer);
  const lines: string[] = [];
  const re = /BT\s*\n([\s\S]*?)\n\s*ET/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    const block = match[1];
    const tj = /\((.*?)\)\s*Tj/g;
    let textMatch;
    while ((textMatch = tj.exec(block)) !== null) {
      let text = textMatch[1];
      if (text.trim()) lines.push(text);
    }
  }
  if (lines.length === 0) {
    return "[No extractable text found in this PDF. The content may be image-based or compressed.]";
  }
  return lines.join(" ");
}
