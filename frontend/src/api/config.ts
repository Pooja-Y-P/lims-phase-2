import axios from "axios";

// Using the more specific base URL, common for versioned APIs
export const API_BASE_URL = "http://127.0.0.1:8000/api";

export const ENDPOINTS = {
  // Authentication, session, and password management
  AUTH: {
    LOGIN: `/users/login`,
    LOGOUT: `/users/logout`,
    ME: `/users/me`,
    FORGOT_PASSWORD: `/auth/forgot-password`,
    RESET_PASSWORD: `/auth/reset-password`,
    VERIFY_TOKEN: (token: string) => `/auth/verify-reset-token/${token}`,
  },
  
  // User resource management (e.g., for Admins)
  USERS: {
    ALL_USERS: `/users`,
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
    INWARD_SEND_REPORT: (id: number) => `/staff/inwards/${id}/send-report`,
    
    // Simplified Draft endpoints
    DRAFTS: `/staff/inwards/drafts`,  // GET - list all drafts
    DRAFT: `/staff/inwards/draft`,    // PATCH - update draft with partial data
    SUBMIT: `/staff/inwards/submit`,  // POST - submit/finalize draft or new form
    DRAFT_DELETE: (id: number) => `/staff/inwards/drafts/${id}`,  // DELETE - remove draft
  },
  
  // Customer-facing portal routes
  PORTAL: {
    ACTIVATE: `/portal/activate-account`,
    INWARDS: `/portal/inwards`,
    INWARD_DETAILS: (id: number) => `/portal/inwards/${id}`,
    SUBMIT_REMARKS: (id: number) => `/portal/inwards/${id}/remarks`,
    DIRECT_ACCESS: (id: number, token?: string) => 
      `/portal/direct/${id}${token ? `?token=${token}` : ''}`,
  },

  // Other primary resources
  CUSTOMERS: `/customers`,
  JOBS: `/jobs`,
  DEVIATIONS: `/deviations`,
  NOTIFICATIONS: `/notifications`,
  SRFS: `/srfs/`,
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

// Enhanced response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const redirectRequired = error.response.headers?.['x-redirect-required'];
      const inwardId = error.response.headers?.['x-inward-id'];
      
      if (redirectRequired && inwardId) {
        localStorage.setItem('postLoginRedirect', `/portal/inwards/${inwardId}`);
      }
      
      window.dispatchEvent(new CustomEvent('auth-logout', { 
        detail: { reason: 'token_expired' }
      }));
      
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);