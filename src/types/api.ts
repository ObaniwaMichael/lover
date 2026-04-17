// API Response Types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  success?: boolean;
}

// Authentication Types
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

// AI Companion Types
export interface CompanionConfig {
  name: string;
  personality: string;
  identity: string;
  gender: string;
  role: string;
}

export interface AIInitializeRequest {
  companionConfig: CompanionConfig;
}

export interface AIInitializeResponse {
  greeting: string;
  companionName: string;
  sessionId: string;
  conversationId: number;
  timestamp: string;
}

export interface AIChatRequest {
  message: string;
  companionConfig: CompanionConfig;
  sessionId?: string;
  conversationId?: number;
}

export interface AIChatResponse {
  message: string;
  companionName: string;
  sessionId: string;
  conversationId: number;
  timestamp: string;
}

// Conversation Types
export interface ConversationMessage {
  id: number;
  content: string;
  sender: string;
  timestamp: string;
  emotion?: string;
}

export interface Conversation {
  sessionId: string;
  companionConfig: CompanionConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse {
  conversation: Conversation;
  messages: ConversationMessage[];
}

export interface ConversationsListResponse {
  conversations: Conversation[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

// Multiplayer Types
export interface MultiplayerSession {
  sessionId: string;
  participantCount: number;
  isActive: boolean;
  lastActivity?: string;
}

export interface MultiplayerMessage {
  text: string;
  sender: string;
  timestamp: string | Date;
  playerName?: string;
}

export interface MultiplayerSessionsResponse {
  sessions: MultiplayerSession[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

// Error Types
export interface ApiError {
  error: string;
  message?: string;
  details?: string[];
  retryAfter?: string;
}

// Health Check Types
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: string;
  memory: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
    external: string;
  };
  activeSessions: number;
  totalConnections: number;
  environment: string;
  version: string;
  health: {
    healthy: boolean;
    issues: string[];
  };
  stats: {
    uptime: string;
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    memoryUsage: number;
    activeConnections: number;
  };
}
