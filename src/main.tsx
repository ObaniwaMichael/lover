import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import logger from './lib/logger'

const setAppHeightVar = () => {
  try {
    const vv = window.visualViewport;
    const height = vv?.height ?? window.innerHeight;
    // Use px because visualViewport is in px.
    document.documentElement.style.setProperty("--app-height", `${height}px`);
  } catch (e) {
    // Non-fatal; fallback to CSS defaults.
    logger.error("Failed to set --app-height:", e);
  }
};

// Global error handler
window.addEventListener('error', (event) => {
  logger.error('Global error:', event.error);
  showUserFriendlyError('An unexpected error occurred. Please refresh the page.');
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
  showUserFriendlyError('A promise error occurred. Please refresh the page.');
});

logger.log('main.tsx: Starting app...');

// User-friendly error display
const showUserFriendlyError = (message: string) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(220, 38, 38, 0.95);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    z-index: 9999;
    font-family: Arial, sans-serif;
    text-align: center;
    padding: 20px;
  `;
  errorDiv.innerHTML = `
    <h1 style="margin: 0 0 20px 0; font-size: 24px;">🚨 Something went wrong</h1>
    <p style="margin: 0 0 20px 0; font-size: 16px;">${message}</p>
    <button onclick="window.location.reload()" style="
      background: white;
      color: #dc2626;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      font-weight: bold;
    ">Refresh Page</button>
  `;
  document.body.appendChild(errorDiv);
};

// Mobile viewport height fix (keyboard + address bar)
setAppHeightVar();
window.addEventListener("resize", setAppHeightVar);
window.addEventListener("orientationchange", setAppHeightVar);
window.visualViewport?.addEventListener("resize", setAppHeightVar);
window.visualViewport?.addEventListener("scroll", setAppHeightVar);

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  logger.log('main.tsx: DOM loaded, initializing React...');
  
  try {
    const rootElement = document.getElementById("root");
    logger.log('main.tsx: Root element found:', rootElement);
    
    if (rootElement) {
      const root = createRoot(rootElement);
      logger.log('main.tsx: Root created, rendering App...');
      root.render(<App />);
    } else {
      logger.error('main.tsx: Root element not found!');
      showUserFriendlyError('Root element not found. Please refresh the page.');
    }
  } catch (error) {
    logger.error('main.tsx: Error rendering app:', error);
    showUserFriendlyError('Failed to render app. Please refresh the page.');
  }
});

// Fallback if DOMContentLoaded doesn't fire
setTimeout(() => {
  if (!document.getElementById("root")?.hasChildNodes()) {
    logger.log('main.tsx: Fallback initialization...');
    try {
      const rootElement = document.getElementById("root");
      if (rootElement) {
        const root = createRoot(rootElement);
        root.render(<App />);
      }
    } catch (error) {
      logger.error('main.tsx: Fallback error:', error);
    }
  }
}, 100);
