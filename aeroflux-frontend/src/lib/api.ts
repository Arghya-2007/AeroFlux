import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/proxy',
  withCredentials: true, // Send cookies to the Next.js proxy
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach CSRF token from cookie to every mutating request
api.interceptors.request.use(
  (config) => {
    if (typeof document !== 'undefined') {
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrfToken='))
        ?.split('=')[1];
      if (csrfToken) {
        config.headers.set('X-CSRF-Token', csrfToken);
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
