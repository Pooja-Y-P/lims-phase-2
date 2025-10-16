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
  CUSTOMERS: `/customers/`,
  SRFS: `/srfs/`,
  INWARDS: `/staff/inwards/`, 
  INWARD_REPORT: (id: number) => `/staff/inwards/${id}/send-report`, 
  JOBS: `/jobs/`,
  DEVIATIONS: `/deviations/`,
  NOTIFICATIONS: `/notifications/`,
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
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);