import { App, Notice, normalizePath } from "obsidian";
import type { ChatMessage } from "./types";

export type ExportFormat = "markdown" | "html";
export type ExportScope = "full" | "assistant";

export async function exportConversationToVault(
  app: App,
  messages: ChatMessage[],
  format: ExportFormat = "markdown",
  scope: ExportScope = "full"
): Promise<string> {
  const filtered = scope === "assistant"
    ? messages.filter((m) => m.role === "assistant")
    : messages;

  if (format === "html") return exportHtml(app, filtered);
  return exportMarkdown(app, filtered);
}

async function exportMarkdown(app: App, messages: ChatMessage[]): Promise<string> {
  const lines: string[] = [];
  lines.push("# Neuro Vault Conversation\n");
  lines.push(`_Exported: ${new Date().toLocaleString()}_\n`);

  for (const msg of messages) {
    switch (msg.role) {
      case "user":
        lines.push(`> ${msg.content}\n`);
        break;
      case "assistant":
        lines.push(`${msg.content}\n`);
        break;
      case "tool":
        lines.push("```");
        lines.push(`// Tool result: ${msg.content.slice(0, 5000)}`);
        lines.push("```\n");
        break;
    }
  }

  const content = lines.join("\n");
  const title = getTitle(messages);
  const timestamp = getTimestamp();
  const path = normalizePath(`NeuroVault/${title} - ${timestamp}.md`);
  return createFile(app, path, content);
}

async function exportHtml(app: App, messages: ChatMessage[]): Promise<string> {
  const parts: string[] = [];
  parts.push(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neuro Vault Conversation</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
  .msg { margin: 12px 0; padding: 12px 16px; border-radius: 8px; line-height: 1.6; }
  .user { background: #264f78; margin-left: 20%; text-align: right; }
  .assistant { background: #2d2d2d; border: 1px solid #404040; }
  .tool { background: #1a1a2e; border: 1px dashed #404040; font-size: 0.85em; opacity: 0.8; }
  .role { font-size: 0.75em; color: #888; margin-bottom: 4px; }
  pre { background: #0d0d0d; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { font-family: "Fira Code", "Consolas", monospace; font-size: 0.85em; }
  h1 { color: #569cd6; }
  .meta { color: #666; font-size: 0.8em; margin-bottom: 24px; }
</style>
</head>
<body>
<h1>Neuro Vault Conversation</h1>
<p class="meta">Exported: ${new Date().toLocaleString()}</p>
`);

  for (const msg of messages) {
    const escaped = escapeHtml(msg.content);
    switch (msg.role) {
      case "user":
        parts.push(`<div class="msg user"><div class="role">You</div>${escaped}</div>\n`);
        break;
      case "assistant":
        parts.push(`<div class="msg assistant"><div class="role">Assistant</div>${escaped}</div>\n`);
        break;
      case "tool":
        parts.push(`<div class="msg tool"><div class="role">Tool</div><pre><code>${escaped.slice(0, 5000)}</code></pre></div>\n`);
        break;
    }
  }

  parts.push(`</body></html>`);

  const content = parts.join("\n");
  const title = getTitle(messages);
  const timestamp = getTimestamp();
  const path = normalizePath(`NeuroVault/${title} - ${timestamp}.html`);
  return createFile(app, path, content);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function getTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  return firstUser?.content.slice(0, 50).replace(/[\\/:*?"<>|]/g, "").trim() || "Chat";
}

function getTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/:/g, "-");
}

async function createFile(app: App, path: string, content: string): Promise<string> {
  const folder = app.vault.getAbstractFileByPath("NeuroVault");
  if (!folder) {
    try { await app.vault.createFolder("NeuroVault"); } catch { /* exists */ }
  }

  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) {
    const file = await app.vault.create(
      path.replace(/\.(\w+)$/, ` ${Date.now()}.$1`),
      content
    );
    return file.path;
  }

  const file = await app.vault.create(path, content);
  return file.path;
}
