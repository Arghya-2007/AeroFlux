import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optional: Add request interceptor to add authorization headers later
api.interceptors.request.use(
  (config) => {
    // If running in browser and token exists, add it
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Optional: Add response interceptor for universal error handling or token refreshing
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // e.g., handle 401 unauthenticated globally here
    return Promise.reject(error);
  }
);

