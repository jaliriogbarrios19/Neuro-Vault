import { App, TFile, TFolder, normalizePath } from "obsidian";
import { registerTool } from "../tool-registry";

registerTool(
  {
    name: "read_file",
    description: "Read the contents of a file from the vault",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file relative to the vault root",
        },
        offset: {
          type: "number",
          description: "Character offset to start reading from (default: 0)",
        },
        limit: {
          type: "number",
          description: "Maximum number of characters to read (default: 50000)",
        },
      },
      required: ["path"],
    },
  },
  async (app, args) => {
    const path = String(args.path ?? "");
    const file = app.vault.getAbstractFileByPath(path);

    if (!file) {
      return JSON.stringify({ error: `File not found: ${path}` });
    }

    if (!(file instanceof TFile)) {
      return JSON.stringify({ error: `Not a file: ${path}` });
    }

    try {
      const content = await app.vault.read(file);
      const offset = Number(args.offset) || 0;
      const limit = Number(args.limit) || 50000;
      const slice = content.slice(offset, offset + limit);
      const endReached = offset + limit >= content.length;

      if (offset === 0 && endReached) {
        return slice;
      }

      const header = `[offset ${offset}/${content.length} chars, reading ${slice.length}]\n`;
      return header + slice + (endReached ? "" : `\n...(more content available, use offset=${offset + limit} to continue)`);
    } catch (e) {
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

registerTool(
  {
    name: "search_notes",
    description: "Search for text across all notes in the vault",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text to search for in vault notes (case-insensitive substring or /regex/)",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  async (app, args) => {
    const rawQuery = String(args.query ?? "");
    const maxResults = Number(args.maxResults) || 10;
    if (!rawQuery) return JSON.stringify({ error: "Missing query" });

    let matcher: (text: string) => number;
    const regexMatch = rawQuery.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexMatch) {
      try {
        const re = new RegExp(regexMatch[1], regexMatch[2]);
        matcher = (text) => {
          const m = re.exec(text);
          return m ? m.index : -1;
        };
      } catch {
        return JSON.stringify({ error: `Invalid regex: ${rawQuery}` });
      }
    } else {
      const lower = rawQuery.toLowerCase();
      matcher = (text) => text.toLowerCase().indexOf(lower);
    }

    const files = app.vault.getMarkdownFiles();
    const results: { path: string; snippet: string }[] = [];

    for (const file of files) {
      if (results.length >= maxResults) break;

      try {
        const content = await app.vault.cachedRead(file);
        const idx = matcher(content);

        if (idx !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(content.length, idx + rawQuery.length + 120);
          const snippet = content.slice(start, end).replace(/\n/g, " ").trim();
          results.push({ path: file.path, snippet });
        }
      } catch {
        continue;
      }
    }

    return JSON.stringify(results);
  }
);

registerTool(
  {
    name: "list_files",
    description: "List files and folders in a vault directory",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to vault root. Use empty string or '/' for root.",
        },
      },
      required: [],
    },
  },
  async (app, args) => {
    const rawPath = String(args.path ?? "").replace(/^\/+/, "");
    let folder: TFile | TFolder | null = null;
    if (!rawPath) {
      folder = app.vault.getRoot();
    } else {
      const found = app.vault.getAbstractFileByPath(rawPath);
      if (found instanceof TFolder) folder = found;
    }

    if (!folder || !(folder instanceof TFolder)) {
      return JSON.stringify({ error: `Directory not found: ${rawPath || "/"}` });
    }

    const entries: { name: string; type: "file" | "folder"; path: string }[] = [];
    for (const child of (folder as TFolder).children) {
      entries.push({
        name: child.name,
        type: child instanceof TFolder ? "folder" : "file",
        path: child.path,
      });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    return JSON.stringify({
      path: folder.path || "/",
      entries,
      count: entries.length,
    });
  }
);

registerTool(
  {
    name: "create_note",
    description: "Create a new note in the vault",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path for the new note relative to vault root. Must end in .md",
        },
        content: {
          type: "string",
          description: "Markdown content for the note",
        },
      },
      required: ["path", "content"],
    },
  },
  async (app, args) => {
    const rawPath = String(args.path ?? "").trim();
    const content = String(args.content ?? "");

    if (!rawPath) {
      return JSON.stringify({ error: "Missing path" });
    }

    const normalized = normalizePath(rawPath);
    if (!normalized.endsWith(".md")) {
      return JSON.stringify({ error: "Path must end with .md" });
    }

    const existing = app.vault.getAbstractFileByPath(normalized);
    if (existing) {
      return JSON.stringify({ error: `File already exists: ${normalized}` });
    }

    try {
      const folderPath = normalized.substring(0, normalized.lastIndexOf("/"));
      if (folderPath) {
        const folder = app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
          await app.vault.createFolder(folderPath);
        }
      }
      const file = await app.vault.create(normalized, content);
      return JSON.stringify({ path: file.path, created: true });
    } catch (e) {
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

registerTool(
  {
    name: "append_note",
    description: "Append content to the end of an existing note",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the note relative to vault root",
        },
        content: {
          type: "string",
          description: "Markdown content to append",
        },
      },
      required: ["path", "content"],
    },
  },
  async (app, args) => {
    const rawPath = String(args.path ?? "").trim();
    const content = String(args.content ?? "");

    if (!rawPath || !content) {
      return JSON.stringify({ error: "Missing path or content" });
    }

    const normalized = normalizePath(rawPath);
    const file = app.vault.getAbstractFileByPath(normalized);

    if (!file || !(file instanceof TFile)) {
      return JSON.stringify({ error: `File not found: ${normalized}` });
    }

    try {
      const current = await app.vault.read(file);
      const separator = current.endsWith("\n") ? "" : "\n";
      await app.vault.modify(file, current + separator + content);
      return JSON.stringify({ path: file.path, appended: true });
    } catch (e) {
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
);
