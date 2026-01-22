import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  // Try to get token from store or local storage
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear session
      clearStoredToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Token management
let cachedToken: string | null = null;

export function setStoredToken(token: string) {
  cachedToken = token;
}

export function getStoredToken(): string | null {
  return cachedToken;
}

export function clearStoredToken() {
  cachedToken = null;
}
