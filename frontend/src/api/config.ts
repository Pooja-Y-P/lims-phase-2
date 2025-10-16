// src/api/config.ts - RECOMMENDED version

import axios from "axios";

// 🛑 Use only the BASE for the Axios instance
export const API_BASE_URL = "http://127.0.0.1:8000/api";

export const ENDPOINTS = {
  USERS: {
    // 🛑 Endpoint paths are now RELATIVE to API_BASE_URL
    LOGIN: `/users/login`, 
    ME: `/users/me`,      
    ALL_USERS: `/users`,  
    LOGOUT: `/users/logout`,
  },
  CUSTOMERS: `/customers/`,
  SRFS: `/srfs/`,
  // 🛑 This is the correct relative path for the Axios instance to use
  INWARDS: `/staff/inwards/`, 
  
  // 🛑 INWARD_REPORT is also now relative
  INWARD_REPORT: (id: number) => `/staff/inwards/${id}/send-report`, 
  
  JOBS: `/jobs/`,
  DEVIATIONS: `/deviations/`,
  NOTIFICATIONS: `/notifications/`,
};

// Axios will automatically use API_BASE_URL for all requests
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});