# NeuroVault — Workflow 2026-06-16

## Sesión 1: Fixes base (8 fixes)

### Fix 1-8: Rendering, sidebar, history, autocomplete, modes
Ver sección anterior del git log. Resumen: rendering pipeline, strip markdown, sidebar con iconos, chat history, incógnito, file autocomplete, chat/agent mode, tool results ocultos.

---

## Sesión 2: 15 mejoras + thinking toggle fix

### Fix 0: Thinking collapse toggle (+/-)
- **Problema**: El carácter `−` (U+2212) no renderizaba bien. El toggle no tenía estilos diferenciados.
- **Fix**: Cambiado a `-` ASCII. Agregada clase `.neuro-vault-loading-toggle-expanded` con hover states.
- **Resultado**: Toggle funciona correctamente, expande y colapsa.

### Mejora 1: Streaming markdown en tiempo real (stream-handler.ts)
- **Problema**: Markdown se renderizaba solo al final del stream.
- **Fix**: Debounce de 500ms que renderiza markdown parcial via `MarkdownRenderer` durante streaming. `stripMarkdown()` sigue mostrando texto limpio inmediato.
- **Resultado**: El usuario ve formato (negritas, headers, code blocks) mientras el LLM escribe.

### Mejora 2: Tool results como tooltip/badge (stream-handler.ts, render-message.ts)
- **Problema**: Tool calls mostraban "Running: name" sin estado. En conversaciones restauradas mostraban JSON crudo con `<details>`.
- **Fix**: Badges inline con icono ⚙, nombre del tool, y status (… → ✓). Tooltip con el resultado al hover. En conversaciones restauradas se muestran los mismos badges.
- **Resultado**: UI limpia, visibilidad de tools sin ensuciar el chat.

### Mejora 3: Keyboard shortcuts (chat-view.ts)
- `Ctrl+L` / `Ctrl+N` → Nuevo chat
- `Ctrl+H` → Toggle historial
- `Ctrl+Shift+M` → Cambiar modo Chat/Agent
- `Ctrl+F` → Buscar en conversación
- `Escape` → Abortar stream

### Mejora 4: Export mejorado (export-conversation.ts, chat-view.ts)
- **Opciones**: Full (Markdown), Full (HTML), Assistant only (Markdown), Assistant only (HTML)
- **HTML**: Estilo dark theme con roles diferenciados, syntax highlighting básico.
- **Acceso**: Menú al hacer click en Export en la sidebar.

### Mejora 5: Model selector en el chat (chat-view.ts, types.ts)
- Dropdown en el header del chat con los modelos del provider actual.
- Cambia el modelo al vuelo, persiste en settings.
- Se actualiza al cambiar de provider en settings.

### Mejora 6: Cost estimation (cost-estimator.ts, chat-view.ts)
- Estimación de tokens (~4 chars/token) y costo por modelo.
- Precios de 22 modelos (GPT, Claude, DeepSeek, Gemini, Grok, GLM).
- Badge después de cada respuesta: `1234 tok · $0.015`.

### Mejora 7: Conversation branching (render-message.ts, chat-actions.ts)
- Botón "Branch" en cada mensaje del assistant.
- Crea una nueva sesión con los mensajes hasta ese punto.
- Permite explorar caminos alternativos sin perder la conversación original.

### Mejora 8: Search in conversation (conversation-search.ts, chat-view.ts)
- Barra de búsqueda con Ctrl+F.
- Resalta todos los matches con `<mark>`.
- Navegación con ↑/↓, contador de matches, cerrar con Escape o ✕.

### Mejora 9: File context panel (file-autocomplete.ts)
- Al seleccionar un archivo con `@`, aparece un preview del contenido debajo del input.
- Muestra header con path y botón de cerrar.
- Trunca a 2000 chars con scroll.

### Mejora 10: Themes (types.ts, settings.ts, chat-view.ts, styles.css)
- Tres opciones: Match Obsidian (default), Custom Dark, Custom Light.
- Custom themes usan CSS custom properties que override los estilos base.
- Selector en Settings → Chat Theme.

### Mejora 11: Voice input (voice-input.ts, chat-view.ts)
- Botón 🎤 al lado del Send.
- Usa Web Speech API (SpeechRecognition).
- Click para activar/detener. Pulso rojo mientras graba.
- Texto se escribe directamente en el input.

### Mejora 12: Multi-model comparison (model-comparison.ts, chat-view.ts)
- Botón "Compare Models" en la sidebar (icono columns).
- Menú para seleccionar modelo alternativo del mismo provider.
- Abre panel con la respuesta del modelo alternativo.
- Stream en tiempo real con markdown render.

### Mejora 13: Plugin API (main.ts)
- `plugin.sendMessage(text)` — Envía un mensaje al chat (abre la vista si no existe).
- `plugin.getConversation()` — Retorna los mensajes actuales.
- `plugin.getActiveChatView()` — Retorna la vista activa.
- Otros plugins acceden via `app.plugins.plugins['neuro-vault']`.

### Mejora 14: Conversation templates (sidebar.ts, chat-actions.ts)
- Botón "Templates" en la sidebar (icono file-text).
- 5 templates: Research Paper Analysis, Code Review, Writing Assistant, Brainstorm, Summarize Notes.
- Al seleccionar, hace New Chat y pre-llena el input.

## Archivos creados/modificados

| Archivo | Líneas | Rol |
|---------|:---:|-----|
| `src/chat-view.ts` | 326 | View principal — sidebar, history, mode, shortcuts |
| `src/chat-actions.ts` | 110 | Export, cost, branch, compare, templates (extraído) |
| `src/session-manager.ts` | 50 | Migración, save, delete de sesiones (extraído) |
| `src/chat-engine.ts` | 166 | Engine — tool filtering por mode |
| `src/stream-handler.ts` | 184 | Streaming + debounce markdown + tool badges |
| `src/sidebar.ts` | 65 | Sidebar con iconos + compare + templates |
| `src/history-panel.ts` | 53 | Panel de historial |
| `src/file-autocomplete.ts` | 154 | Autocompletado + file preview |
| `src/conversation-search.ts` | 116 | Búsqueda en conversación |
| `src/cost-estimator.ts` | 65 | Estimación de tokens y costo |
| `src/model-comparison.ts` | 67 | Comparación entre modelos |
| `src/voice-input.ts` | 58 | Dictado por voz |
| `src/export-conversation.ts` | 118 | Export MD/HTML, full/assistant |
| `src/render-message.ts` | 78 | Rendering con tool badges + branch btn |
| `src/strip-markdown.ts` | 9 | Limpieza de markdown |
| `src/types.ts` | 180 | Tipos + chatTheme |
| `main.ts` | 102 | Plugin API (sendMessage, getConversation) |
| `styles.css` | ~700 | Todos los estilos + themes + nuevos componentes |

## Notas técnicas

- **Build**: `npm run build`
- **Tests**: `npm test` — 9 tests, 2 archivos
- **Typecheck**: `npx tsc --noEmit` — ✅ limpio
- **Límite de líneas**: chat-view.ts (326) y settings.ts (326) están sobre el límite de 300. settings.ts ya estaba sobre el límite antes. chat-view.ts se extrajo chat-actions.ts y session-manager.ts pero sigue siendo el archivo principal.

---

## Sesión 3: Fecha dinámica, review bot compliance, MiMo, GitHub

### Fix: Fecha dinámica en system prompt (chat-engine.ts)
- **Problema**: El modelo no sabe qué día es — no puede responder preguntas temporales.
- **Fix**: `buildSystemPrompt()` inyecta `Today's date is <fecha>` al system prompt. Se regenera en cada `reset()` con la fecha actual. `basePrompt` se guarda separado para no duplicar.
- **Resultado**: El modelo siempre tiene contexto temporal correcto.

### Fix: Obsidian review bot compliance
- **Problema**: El bot rechaza `createEl("h2"/"h3")`, `getRightLeaf(false)`, y `.style.display = ...`.
- **Fix**:
  - Headings → `new Setting().setName().setHeading()` (settings.ts, 5 headings)
  - `getRightLeaf(false)` → `workspace.getLeaf(true)` (main.ts, mobile compat)
  - `.style.display` → clases CSS `.nv-hidden` + `toggleClass`/`addClass`/`removeClass`
  - `.style.height` dinámico → `setCssProps({ "--nv-h": value })` + CSS `height: var(--nv-h)`
- **Resultado**: Limpio para review del bot. `fetch()` para SSE streaming es aceptable (requestUrl no soporta ReadableStream).

### Feat: Modelos MiMo en OpenRouter (types.ts)
- Agregados `xiaomi/mimo-v2.5-pro` y `xiaomi/mimo-v2.5` a la lista de OpenRouter.

### Infra: Git + GitHub
- Inicializado repositorio git en el directorio del proyecto.
- Remote: `https://github.com/jaliriogbarrios19/Neuro-Vault`
- Branch: `main`
- Commits: initial (50 archivos, 7659 líneas) + MiMo models (1 archivo, +2 líneas)
- Builds copiados a:
  - `D:\Neuro Vault test\Neuro Vault Test\.obsidian\plugins\neuro-vault\`
  - `D:\Obsidian Files\Jesús\.obsidian\plugins\neuro-vault\`
