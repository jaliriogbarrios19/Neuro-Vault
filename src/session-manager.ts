import type { App } from "obsidian";
import type { ChatMessage, ChatSession, PluginSettings } from "./types";
import { generateSessionId, getSessionTitle } from "./history-panel";

export function migrateOldConversation(settings: PluginSettings): boolean {
  if (settings.conversationMessages?.length && !settings.chatSessions?.length) {
    const session: ChatSession = {
      id: generateSessionId(),
      title: getSessionTitle(settings.conversationMessages),
      messages: settings.conversationMessages,
      createdAt: Date.now(),
    };
    settings.chatSessions = [session];
    settings.activeSessionId = session.id;
    delete settings.conversationMessages;
    return true;
  }
  return false;
}

export function findActiveSession(settings: PluginSettings): ChatSession | undefined {
  if (!settings.chatSessions || !settings.activeSessionId) return undefined;
  return settings.chatSessions.find((s) => s.id === settings.activeSessionId);
}

export function saveCurrentSession(
  settings: PluginSettings,
  messages: ChatMessage[],
  sessionId: string | undefined
): string {
  if (!messages.length) return sessionId || "";
  const activeId = sessionId || generateSessionId();
  const sessions = settings.chatSessions || [];
  const existing = sessions.findIndex((s) => s.id === activeId);
  const session: ChatSession = {
    id: activeId,
    title: getSessionTitle(messages),
    messages,
    createdAt: existing >= 0 ? sessions[existing].createdAt : Date.now(),
  };
  if (existing >= 0) sessions[existing] = session;
  else sessions.push(session);
  settings.chatSessions = sessions;
  settings.activeSessionId = activeId;
  return activeId;
}

export function deleteSession(settings: PluginSettings, sessionId: string): boolean {
  const sessions = settings.chatSessions || [];
  settings.chatSessions = sessions.filter((s) => s.id !== sessionId);
  const wasActive = settings.activeSessionId === sessionId;
  if (wasActive) settings.activeSessionId = undefined;
  return wasActive;
}
