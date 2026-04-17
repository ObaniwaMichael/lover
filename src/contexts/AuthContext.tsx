import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { User, AuthContextType } from './AuthContextTypes';
import { AuthContext } from './AuthContextDefinition';
import logger from '../lib/logger';



interface AuthProviderProps {
  children: ReactNode;
}

// Token storage utility - using sessionStorage for better security (cleared on tab close)
const getStoredToken = (): string | null => {
  try {
    return sessionStorage.getItem('token');
  } catch (error) {
    logger.error('Failed to read token from storage:', error);
    return null;
  }
};

const setStoredToken = (token: string | null): void => {
  try {
    if (token) {
      sessionStorage.setItem('token', token);
    } else {
      sessionStorage.removeItem('token');
    }
  } catch (error) {
    logger.error('Failed to write token to storage:', error);
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = getStoredToken();
      
      if (storedToken) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for auth check
        
        try {
          const response = await fetch(API_ENDPOINTS.AUTH_ME, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            setToken(storedToken);
          } else {
            // Token is invalid, remove it
            logger.log('Token validation failed, removing from storage');
            setStoredToken(null);
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          
          // Don't log timeout errors as they're expected if server is down
          if (error instanceof Error && error.name !== 'AbortError') {
            logger.error('Auth check failed:', error);
          }
          
          // Only clear token on actual errors, not timeouts (keep user logged in if server is temporarily down)
          if (error instanceof Error && !error.name.includes('Abort')) {
            setStoredToken(null);
            setToken(null);
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []); // Only run on mount, not when token changes





  const login = async (username: string, password: string) => {
    let controller = new AbortController();
    let timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      setError(null);

      let lastError: Error | null = null;
      const maxRetries = 2;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(API_ENDPOINTS.AUTH_LOGIN, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Login failed: ${response.statusText}`);
          }

          const data = await response.json();

          setStoredToken(data.token);
          setToken(data.token);
          setUser(data.user);
          return;
        } catch (error) {
          clearTimeout(timeoutId);

          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              throw new Error('Request timed out. Please check your connection and try again.');
            }

            if (error.message.includes('401') || error.message.includes('Invalid')) {
              throw error;
            }

            lastError = error;

            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
              controller = new AbortController();
              timeoutId = window.setTimeout(() => controller.abort(), 15000);
            }
          } else {
            lastError = new Error('Unknown error occurred');
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError || new Error('Login failed after multiple attempts');
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Login failed. Please check your connection and try again.';
      setError(errorMessage);
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string) => {
    let controller = new AbortController();
    let timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      setError(null);

      let lastError: Error | null = null;
      const maxRetries = 2;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(API_ENDPOINTS.AUTH_REGISTER, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Registration failed: ${response.statusText}`);
          }

          const data = await response.json();

          setStoredToken(data.token);
          setToken(data.token);
          setUser(data.user);
          return;
        } catch (error) {
          clearTimeout(timeoutId);

          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              throw new Error('Request timed out. Please check your connection and try again.');
            }

            if (error.message.includes('400') || error.message.includes('409') ||
                error.message.includes('already exists') || error.message.includes('required')) {
              throw error;
            }

            lastError = error;

            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
              controller = new AbortController();
              timeoutId = window.setTimeout(() => controller.abort(), 15000);
            }
          } else {
            lastError = new Error('Unknown error occurred');
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError || new Error('Registration failed after multiple attempts');
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Registration failed. Please check your connection and try again.';
      setError(errorMessage);
      throw error;
    }
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setError(null);
  };

    // Refresh authentication state (useful for page refreshes)
  const refreshAuth = useCallback(async () => {
    const storedToken = getStoredToken();
    if (storedToken && !user) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(API_ENDPOINTS.AUTH_ME, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setToken(storedToken);
          return true;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name !== 'AbortError') {
          logger.error('Auth refresh failed:', error);
        }
      }
    }
    return false;
  }, [user]);

  // Listen for window focus to refresh authentication state
  useEffect(() => {
    const handleFocus = () => {
      if (token && user) {
        // User is already authenticated, just verify token is still valid
        refreshAuth();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [token, user, refreshAuth]);

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    refreshAuth,
    loading,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 