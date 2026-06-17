# Neuro Vault

AI agent chat inside Obsidian with tools: vault operations, web search, academic research, and more.

## Features

- **8 LLM providers**: OpenAI, Anthropic Claude, DeepSeek, Google Gemini, OpenRouter, Grok (xAI), GLM (Z.ai), spob
- **Streaming responses** with markdown rendering
- **Tool-augmented agent**: the AI can read, search, list, create, and edit notes in your vault
- **Web search** via Brave Search API
- **Academic research** with PubMed + OpenAlex agentic pipeline
- **Conversation persistence** — pick up where you left off
- **Export chats** as markdown notes
- **Customizable system prompt**

## Installation

### Community Plugin (coming soon)

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/jaliriogbarrios19/Neuro-Vault/releases)
2. Copy them to `.obsidian/plugins/neuro-vault/` in your vault
3. Enable the plugin in Settings → Community Plugins

### Development

```bash
git clone https://github.com/jaliriogbarrios19/Neuro-Vault.git
cd Neuro-Vault
npm install
npm run dev    # watch mode
npm run build  # production build
```

## Configuration

Go to Settings → Neuro Vault:

| Setting | Description |
|---------|-------------|
| **LLM Provider** | Choose your AI provider |
| **API Key** | Provider-specific API key |
| **Model** | Select the model for your provider |
| **Brave Search API Key** | Required for `web_search` tool |
| **PubMed API Key** | Optional, increases rate limit |
| **OpenAlex Email** | For polite API access |
| **Custom System Prompt** | Override the default agent behavior |

## Tools

The AI agent has access to these tools:

| Tool | Description |
|------|-------------|
| `read_file` | Read vault file contents |
| `search_notes` | Full-text search across all notes |
| `list_files` | List files and folders in a directory |
| `create_note` | Create a new markdown note |
| `append_note` | Append content to an existing note |
| `web_search` | Search the web via Brave Search |
| `academic_search` | Search PubMed + OpenAlex with iterative refinement |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Escape` | Stop generation |
| `Ctrl+N` | New Chat |

## License

MIT
