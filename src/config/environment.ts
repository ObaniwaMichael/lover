// Environment configuration
import { getApiBaseUrl, getSocketUrl } from './site';

export const config = {
  // API Configuration
  api: {
    baseURL: getApiBaseUrl(),
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '15000'),
    retries: parseInt(import.meta.env.VITE_API_RETRIES || '3'),
  },
  
  // Socket Configuration
  socket: {
    url: getSocketUrl(),
    reconnectAttempts: parseInt(import.meta.env.VITE_SOCKET_RECONNECT_ATTEMPTS || '5'),
    reconnectDelay: parseInt(import.meta.env.VITE_SOCKET_RECONNECT_DELAY || '1000'),
  },
  
  // Feature Flags
  features: {
    aiCompanion: import.meta.env.VITE_ENABLE_AI_COMPANION !== 'false',
    multiplayer: import.meta.env.VITE_ENABLE_MULTIPLAYER !== 'false',
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    debug: import.meta.env.VITE_DEBUG === 'true',
  },
  
  // App Configuration
  app: {
    name: import.meta.env.VITE_APP_NAME || "Lover's Code",
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.MODE || 'development',
  },
  
  // Performance Configuration
  performance: {
    renderThreshold: parseInt(import.meta.env.VITE_RENDER_THRESHOLD || '16'),
    logPerformance: import.meta.env.VITE_LOG_PERFORMANCE === 'true',
  }
};

/**
 * Optional client-side check. `VITE_API_BASE_URL` is not required: production builds use
 * same origin via `site.ts` when unset (typical nginx + VM setup).
 */
export const validateEnvironment = () => {
  return true;
};

export default config;
