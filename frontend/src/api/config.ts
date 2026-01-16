import axios from "axios";

export const BACKEND_ROOT_URL = "http://127.0.0.1:8000"; 
export const API_BASE_URL = `${BACKEND_ROOT_URL}/api`;

export const ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: `/users/login`,
    LOGOUT: `/users/logout`,
    ME: `/users/me`,
    REFRESH: `/users/refresh`,
    FORGOT_PASSWORD: `/auth/forgot-password`,
    RESET_PASSWORD: `/auth/reset-password`,
    VERIFY_TOKEN: (token: string) => `/auth/verify-reset-token/${token}`,
  },
  
  // User management
  USERS: {
    ALL_USERS: `/users`,
    UPDATE_STATUS: (id: number) => `/users/${id}/status`,
  },

  // Invitations
  INVITATIONS: {
    SEND: '/invitations/send',
    ACCEPT: '/invitations/accept',
    VALIDATE: '/invitations/validate',
  },
  
  // Staff
  STAFF: {
    SRFS: `/staff/srfs`,
    INWARDS: `/staff/inwards`,
    INWARDS_UPDATED: `/staff/inwards/updated`,
    INWARDS_EXPORTABLE: `/staff/inwards/exportable-list`,
    INWARD_EXPORT: (id: number) => `/staff/inwards/${id}/export`,
    INWARD_EXPORT_BATCH: `/staff/inwards/export-batch`,
    INWARD_EXPORT_BATCH_INWARD_ONLY: `/staff/inwards/export-batch-inward-only`,
    INWARD_SEND_REPORT: (id: number) => `/staff/inwards/${id}/send-report`,
    DRAFTS: `/staff/inwards/drafts`,
    DRAFT: `/staff/inwards/draft`,
    SUBMIT: `/staff/inwards/submit`,
    DRAFT_DELETE: (id: number) => `/staff/inwards/drafts/${id}`,
  },
  
  // Portal
  PORTAL: {
    ACTIVATE: `/portal/activate-account`,
    INWARDS: `/portal/inwards`,
    INWARD_DETAILS: (id: number) => `/portal/inwards/${id}`,
    SUBMIT_REMARKS: (id: number) => `/portal/inwards/${id}/remarks`,
    DIRECT_ACCESS: (id: number, token?: string) => 
      `/portal/direct-fir/${id}${token ? `?token=${token}` : ''}`,
    CUSTOMERS_DROPDOWN: `/portal/customers/dropdown`,
  },

  // Common
  CUSTOMERS: `/customers`,
  JOBS: `/jobs`,
  DEVIATIONS: `/deviations`,
  NOTIFICATIONS: `/notifications`,
  SRFS: `/srfs/`,

  // SRF Drafts
  SRF_DRAFTS: {
    SAVE: (id: number) => `/srfs/draft/${id}`,
    CREATE: `/srfs/draft`,
    RESTORE: (id: number) => `/srfs/draft/${id}/restore`,
    CLEAR: (id: number) => `/srfs/draft/${id}`,
  },

  // HTW Masters
  HTW_MASTER_STANDARDS: {
    LIST: `/htw-master-standards/`,
    GET: (id: number) => `/htw-master-standards/${id}`,
    CREATE: `/htw-master-standards/`,
    UPDATE: (id: number) => `/htw-master-standards/${id}`,
    UPDATE_STATUS: (id: number) => `/htw-master-standards/${id}/status`,
    DELETE: (id: number) => `/htw-master-standards/${id}`,
    EXPORT: `/htw-master-standards/export`,
    EXPORT_BATCH: `/htw-master-standards/export-batch`,
  },

  // HTW Jobs
  HTW_JOBS: {
    CREATE: "/htw-jobs/",
    UPDATE: "/htw-jobs",
    AUTO_SELECT_BASE: "/jobs"
  },

  // --- NEW: HTW ENVIRONMENT ---
  HTW_ENVIRONMENT: {
    // GET (list) or POST (create) environment record
    BASE: (jobId: number) => `/staff/jobs/${jobId}/environment`, 
    // Check status gates
    PRE_STATUS: (jobId: number) => `/staff/jobs/${jobId}/environment/pre-status`,
    POST_STATUS: (jobId: number) => `/staff/jobs/${jobId}/environment/post-status`,
  },

  // --- CALCULATION ENDPOINTS ---
  
  // Section A (Legacy mapping)
  HTW_REPEATABILITY: {
    CALCULATE: "/htw-calculations/repeatability/calculate",
    GET: (jobId: number) => `/htw-calculations/repeatability/${jobId}`,
    REFERENCES: "/htw-calculations/repeatability/references/list",
  },
  
  // Section B (Legacy mapping)
  HTW_REPRODUCIBILITY: {
    CALCULATE: "/htw-calculations/reproducibility/calculate",
    GET: (jobId: number) => `/htw-calculations/reproducibility/${jobId}`,
  },

  // Unified Group for New Sections (C, D, E)
  HTW_CALCULATIONS: {
    OUTPUT_DRIVE: `/htw-calculations/output-drive`, // GET append /{jobId}
    OUTPUT_DRIVE_CALCULATE: `/htw-calculations/output-drive/calculate`,
    
    DRIVE_INTERFACE: `/htw-calculations/drive-interface`, // GET append /{jobId}
    DRIVE_INTERFACE_CALCULATE: `/htw-calculations/drive-interface/calculate`,
    
    LOADING_POINT: `/htw-calculations/loading-point`, // GET append /{jobId}
    LOADING_POINT_CALCULATE: `/htw-calculations/loading-point/calculate`,
  },

  // Specs & Resolutions
  HTW_MANUFACTURER_SPECS: {
    LIST: `/htw-manufacturer-specs/`,
    GET: (id: number) => `/htw-manufacturer-specs/${id}`,
    CREATE: `/htw-manufacturer-specs/`,
    UPDATE: (id: number) => `/htw-manufacturer-specs/${id}`,
    UPDATE_STATUS: (id: number) => `/htw-manufacturer-specs/${id}/status`,
    DELETE: (id: number) => `/htw-manufacturer-specs/${id}`,
  },

  HTW_PRESSURE_GAUGE_RESOLUTIONS: {
    LIST: `/htw-pressure-gauge-resolutions/`,
    UNITS: `/htw-pressure-gauge-resolutions/units`,
  },

  HTW_NOMENCLATURE_RANGES: {
    LIST: `/htw-nomenclature-ranges/`,
    GET: (id: number) => `/htw-nomenclature-ranges/${id}`,
    CREATE: `/htw-nomenclature-ranges/`,
    UPDATE: (id: number) => `/htw-nomenclature-ranges/${id}`,
    UPDATE_STATUS: (id: number) => `/htw-nomenclature-ranges/${id}/status`,
    DELETE: (id: number) => `/htw-nomenclature-ranges/${id}`,
    MATCH: `/htw-nomenclature-ranges/match`,
  }
} as const;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ... (Rest of interceptors remain unchanged)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
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