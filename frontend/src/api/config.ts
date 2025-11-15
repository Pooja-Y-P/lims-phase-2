import axios from "axios";

export const BACKEND_ROOT_URL = "http://127.0.0.1:8000"; // Base URL for backend, including static files
// Using the more specific base URL, common for versioned APIs
export const API_BASE_URL = `${BACKEND_ROOT_URL}/api`;

export const ENDPOINTS = {
  // Authentication, session, and password management
  AUTH: {
    LOGIN: `/users/login`,
    LOGOUT: `/users/logout`,
    ME: `/users/me`,
    REFRESH: `/users/refresh`,
    FORGOT_PASSWORD: `/auth/forgot-password`,
    RESET_PASSWORD: `/auth/reset-password`,
    VERIFY_TOKEN: (token: string) => `/auth/verify-reset-token/${token}`,
  },
  
  // User resource management (e.g., for Admins)
  USERS: {
    ALL_USERS: `/users`,
    UPDATE_STATUS: (id: number) => `/users/${id}/status`,
  },

  // Invitation management
  INVITATIONS: {
    SEND: '/invitations/send',
    ACCEPT: '/invitations/accept',
    VALIDATE: '/invitations/validate',
  },
  
  // Staff-specific routes
  STAFF: {
    SRFS: `/staff/srfs`,
    INWARDS: `/staff/inwards`,
    INWARDS_UPDATED: `/staff/inwards/updated`,
    INWARDS_EXPORTABLE: `/staff/inwards/exportable-list`, // <-- NEW ENDPOINT ADDED
    INWARD_EXPORT: (id: number) => `/staff/inwards/${id}/export`,
    INWARD_EXPORT_BATCH: `/staff/inwards/export-batch`,
    INWARD_SEND_REPORT: (id: number) => `/staff/inwards/${id}/send-report`,
    
    // Simplified Draft endpoints
    DRAFTS: `/staff/inwards/drafts`,
    DRAFT: `/staff/inwards/draft`,
    SUBMIT: `/staff/inwards/submit`,
    DRAFT_DELETE: (id: number) => `/staff/inwards/drafts/${id}`,
  },
  
  // Customer-facing portal routes
  PORTAL: {
    ACTIVATE: `/portal/activate-account`,
    INWARDS: `/portal/inwards`,
    INWARD_DETAILS: (id: number) => `/portal/inwards/${id}`,
    SUBMIT_REMARKS: (id: number) => `/portal/inwards/${id}/remarks`,
    DIRECT_ACCESS: (id: number, token?: string) => 
      `/portal/direct-fir/${id}${token ? `?token=${token}` : ''}`,
    CUSTOMERS_DROPDOWN: `/portal/customers/dropdown`,
  },

  // Other primary resources
  CUSTOMERS: `/customers`,
  JOBS: `/jobs`,
  DEVIATIONS: `/deviations`,
  NOTIFICATIONS: `/notifications`,
  SRFS: `/srfs/`,

  // SRF Draft endpoints
  SRF_DRAFTS: {
    SAVE: (id: number) => `/srfs/draft/${id}`,
    CREATE: `/srfs/draft`,
    RESTORE: (id: number) => `/srfs/draft/${id}/restore`,
    CLEAR: (id: number) => `/srfs/draft/${id}`,
  }
} as const;

// Create axios instance with default configuration
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add the authentication token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

type FailedQueueItem = {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let failedQueue: FailedQueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const handleUnauthorized = (error: any) => {
  const redirectRequired = error.response?.headers?.['x-redirect-required'];
  const inwardId = error.response?.headers?.['x-inward-id'];

  if (redirectRequired && inwardId) {
    localStorage.setItem('postLoginRedirect', `/portal/inwards/${inwardId}`);
  }

  window.dispatchEvent(new CustomEvent('auth-logout', {
    detail: { reason: 'token_expired' }
  }));

  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');

  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

// Enhanced response interceptor with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config as (typeof error.config) & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url !== ENDPOINTS.AUTH.LOGIN &&
      originalRequest.url !== ENDPOINTS.AUTH.REFRESH
    ) {
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        handleUnauthorized(error);
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string | null) => {
              if (!token) {
                reject(error);
                return;
              }
              if (!originalRequest.headers) {
                originalRequest.headers = {};
              }
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        axios.post(
          `${API_BASE_URL}${ENDPOINTS.AUTH.REFRESH}`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        )
          .then((response) => {
            const { access_token, refresh_token } = response.data;

            localStorage.setItem('token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            window.dispatchEvent(
              new CustomEvent('auth-token-refreshed', {
                detail: { accessToken: access_token, refreshToken: refresh_token },
              })
            );

            api.defaults.headers.common.Authorization = `Bearer ${access_token}`;

            processQueue(null, access_token);

            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${access_token}`;

            resolve(api(originalRequest));
          })
          .catch((refreshError) => {
            processQueue(refreshError, null);
            handleUnauthorized(error);
            reject(refreshError);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    if (
      error.response?.status === 401 &&
      originalRequest?.url !== ENDPOINTS.AUTH.LOGIN &&
      originalRequest?.url !== ENDPOINTS.AUTH.REFRESH
    ) {
      handleUnauthorized(error);
    }

    return Promise.reject(error);
  }
);