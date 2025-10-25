// src/api/config.ts

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

  // Invitation management (from the first file)
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
  },
  
  // Customer-facing portal routes
  PORTAL: {
    ACTIVATE: `/portal/activate-account`,
    INWARDS: `/portal/inwards`,
    INWARD_DETAILS: (id: number) => `/portal/inwards/${id}`,
    SUBMIT_REMARKS: (id: number) => `/portal/inwards/${id}/remarks`,
  },

  // Other primary resources
  CUSTOMERS: `/customers`,
  JOBS: `/jobs`,
  DEVIATIONS: `/deviations`,
  NOTIFICATIONS: `/notifications`,

} as const; // Using 'as const' for better type safety and autocompletion

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
    // Ensure headers object exists before modification
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle global error cases, like 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the error is 401, redirect to login
    if (error.response?.status === 401) {
      // Add a check to avoid redirect loops if the user is already on the login page
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        // Use location.assign() for a full page reload to clear any stale state
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);