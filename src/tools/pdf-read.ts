import { App, TFile, normalizePath } from "obsidian";
import { registerTool } from "../tool-registry";

const PDF_LIMIT = 50000;

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
        offset: {
          type: "number",
          description: "Character offset to start reading from (default: 0)",
        },
        limit: {
          type: "number",
          description: "Maximum characters to return (default: 50000)",
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
      const text = await extractPdfText(arrayBuffer);

      const offset = Number(args.offset) || 0;
      const limit = Number(args.limit) || PDF_LIMIT;
      const slice = text.slice(offset, offset + limit);
      const endReached = offset + limit >= text.length;

      if (offset === 0 && endReached) {
        return JSON.stringify({ path: file.path, text: slice, size: arrayBuffer.byteLength });
      }

      const header = `[offset ${offset}/${text.length} chars, reading ${slice.length}]\n`;
      return JSON.stringify({
        path: file.path,
        text: header + slice + (endReached ? "" : `\n...(more content available, use offset=${offset + limit} to continue)`),
        size: arrayBuffer.byteLength,
      });
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
    }
  }
);

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str || "")
      .join(" ");
    if (pageText.trim()) pages.push(pageText);
  }

  if (pages.length === 0) {
    return "[No extractable text found in this PDF. The content may be image-based or scanned.]";
  }
  return pages.join("\n\n");
}
