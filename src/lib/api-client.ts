import logger from './logger';
import { getApiBaseUrl } from '@/config/site';
import { jsonAuthHeaders } from './auth-headers';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retries: number;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 10000;
    this.retries = config.retries || 3;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...jsonAuthHeaders(),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, statusCode: response.status };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.error(`Request timeout for ${endpoint}`);
          throw new Error('Request timeout');
        }
        
        // Retry logic for network errors
        if (retryCount < this.retries && this.isRetryableError(error)) {
          logger.warn(`Retrying request to ${endpoint} (attempt ${retryCount + 1}/${this.retries})`);
          await this.delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
          return this.request(endpoint, options, retryCount + 1);
        }
        
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'NetworkError',
      'TypeError',
      'AbortError'
    ];
    
    return retryableErrors.some(type => error.name.includes(type));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Create default API client instance
export const apiClient = new ApiClient({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  retries: 3,
});

export default ApiClient;
