// src/api/config.ts

import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8000/api";

export const ENDPOINTS = {
  USERS: {
    LOGIN: `/users/login`, 
    ME: `/users/me`,      
    ALL_USERS: `/users`,  
    LOGOUT: `/users/logout`,
  },
  
  // --- FIX: Removed trailing slashes from base paths ---
  CUSTOMERS: `/customers`,
  SRFS: `/staff/srfs`,
  INWARDS: `/staff/inwards`, // The main fix is here
  
  // Dynamic endpoints are fine as they are
  INWARD_REPORT: (id: number) => `/staff/inwards/${id}/send-report`, 
  
  JOBS: `/jobs`,
  DEVIATIONS: `/deviations`,
  NOTIFICATIONS: `/notifications`,
  
  AUTH: {
    FORGOT_PASSWORD: `/auth/forgot-password`,
    RESET_PASSWORD: `/auth/reset-password`,
    VERIFY_TOKEN: (token: string) => `/auth/verify-reset-token/${token}`,
  },
  PORTAL: {
    ACTIVATE: `/portal/activate-account`,
    INWARDS: `/portal/inwards`,
    INWARD_DETAILS: (id: number) => `/portal/inwards/${id}`,
    SUBMIT_REMARKS: (id: number) => `/portal/inwards/${id}/remarks`,
  }
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token
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

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Optional: Add a check to avoid redirect loops if already on the login page
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);