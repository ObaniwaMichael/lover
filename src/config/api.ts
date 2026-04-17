// API Configuration — self-hosted VM / local; see src/config/site.ts
import { getApiBaseUrl } from "./site";

const API_BASE = getApiBaseUrl();

export const API_ENDPOINTS = {
  // AI Companion
  AI_INITIALIZE: `${API_BASE}/api/ai-companion/initialize`,
  AI_CHAT: `${API_BASE}/api/ai-companion/chat`,
  
  // Authentication
  AUTH_LOGIN: `${API_BASE}/api/auth/login`,
  AUTH_REGISTER: `${API_BASE}/api/auth/register`,
  AUTH_ME: `${API_BASE}/api/auth/profile`,
  
  // Multiplayer
  MULTIPLAYER_JOIN: `${API_BASE}/api/multiplayer/join`,
  MULTIPLAYER_MESSAGE: `${API_BASE}/api/multiplayer/message`,
  MULTIPLAYER_SESSIONS: `${API_BASE}/api/multiplayer/sessions`,
  MULTIPLAYER_SESSIONS_SEARCH: `${API_BASE}/api/multiplayer/sessions/search`,
  MULTIPLAYER_SESSION_DETAIL: (sessionId: string) => `${API_BASE}/api/multiplayer/sessions/${sessionId}`,
  MULTIPLAYER_SESSION_EXPORT: (sessionId: string) => `${API_BASE}/api/multiplayer/sessions/${sessionId}/export`,
  MULTIPLAYER_SESSION_DELETE: (sessionId: string) => `${API_BASE}/api/multiplayer/sessions/${sessionId}`,
  
  // Conversations
  CONVERSATIONS: `${API_BASE}/api/conversations`,
  CONVERSATIONS_SEARCH: `${API_BASE}/api/conversations/search`,
  CONVERSATION_DETAIL: (sessionId: string) => `${API_BASE}/api/conversations/${sessionId}`,
  CONVERSATION_EXPORT: (conversationId: string) => `${API_BASE}/api/conversations/${conversationId}/export`,
  CONVERSATION_TITLE: (conversationId: string) => `${API_BASE}/api/conversations/${conversationId}/title`,
  CONVERSATION_DELETE: (sessionId: string) => `${API_BASE}/api/conversations/${sessionId}`,
  
  // Statistics
  STATS_CONVERSATIONS: `${API_BASE}/api/stats/conversations`,
  STATS_MESSAGES: `${API_BASE}/api/stats/messages`,
  STATS_COMPANIONS: `${API_BASE}/api/stats/companions`,
};

export default API_ENDPOINTS;
