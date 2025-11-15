// src/auth/AuthProvider.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types'; // Assuming 'User' type is defined in your project
import { api, ENDPOINTS } from '../api/config';

type AuthBroadcastPayload =
  | {
      type: 'login';
      payload: { user: User };
    }
  | {
      type: 'logout';
    };

type AuthBroadcastMessage = AuthBroadcastPayload & { source: string };

export interface UserInfo {
  name?: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  bootstrapped: boolean; // Flag to indicate if initial auth check is complete
  refreshAccessToken: () => Promise<void>;
  timeUntilExpiry: number | null;
  isTokenExpiringSoon: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);

  const logoutTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const authChannelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>('');

  if (!tabIdRef.current) {
    tabIdRef.current = `auth-tab-${Math.random().toString(36).slice(2)}`;
  }

  const decodeTokenExpiry = useCallback((token: string | null | undefined): number | null => {
    if (!token) {
      return null;
    }

    try {
      const [, payload] = token.split('.');
      if (!payload) {
        return null;
      }

      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload =
        normalizedPayload + '='.repeat((4 - (normalizedPayload.length % 4)) % 4);
      const decoded = JSON.parse(window.atob(paddedPayload));

      if (decoded?.exp && typeof decoded.exp === 'number') {
        return decoded.exp * 1000;
      }
    } catch (error) {
      console.warn('Failed to decode token expiry', error);
    }

    return null;
  }, []);

  const clearCountdownTimers = useCallback(() => {
    if (logoutTimeoutRef.current) {
      window.clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }

    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearAuthState = useCallback(() => {
    clearCountdownTimers();
    setTokenExpiry(null);
    setTimeUntilExpiry(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setBootstrapped(true);
  }, [clearCountdownTimers]);

  const applyLoginState = useCallback(
    (userData: User) => {
      clearCountdownTimers();

      if (userData.token) {
        localStorage.setItem('token', userData.token);
        setTokenExpiry(decodeTokenExpiry(userData.token));
      } else {
        localStorage.removeItem('token');
        setTokenExpiry(null);
      }

      if (userData.refresh_token) {
        localStorage.setItem('refresh_token', userData.refresh_token);
      }

      setUser(userData);
      setTimeUntilExpiry(null);
      setBootstrapped(true);
    },
    [clearCountdownTimers, decodeTokenExpiry]
  );

  const sendAuthMessage = useCallback(
    (message: AuthBroadcastPayload) => {
      const channel = authChannelRef.current;
      if (!channel) {
        return;
      }
      channel.postMessage({
        ...message,
        source: tabIdRef.current,
      });
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return;
    }

    const channel = new BroadcastChannel('auth');
    authChannelRef.current = channel;

    const handleMessage = (event: MessageEvent<AuthBroadcastMessage>) => {
      const data = event.data;
      if (!data || data.source === tabIdRef.current) {
        return;
      }

      switch (data.type) {
        case 'login': {
          applyLoginState(data.payload.user);
          break;
        }
        case 'logout': {
          clearAuthState();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;
        }
        default:
          break;
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      authChannelRef.current = null;
    };
  }, [applyLoginState, clearAuthState]);

  // Check for an existing session on app startup
  useEffect(() => {
    const checkExistingSession = async () => {
      let token = localStorage.getItem('token');
      const existingRefreshToken = localStorage.getItem('refresh_token');

      if (!token && existingRefreshToken) {
        try {
          const response = await api.post(ENDPOINTS.AUTH.REFRESH, {
            refresh_token: existingRefreshToken,
          });
          token = response.data.access_token;
          localStorage.setItem('token', response.data.access_token);
          localStorage.setItem('refresh_token', response.data.refresh_token);
        } catch (error) {
          console.warn('Unable to refresh session during bootstrap:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          setUser(null);
          setBootstrapped(true);
          return;
        }
      }

      if (!token) {
        setBootstrapped(true);
        return;
      }

      setTokenExpiry(decodeTokenExpiry(token));

      try {
        const response = await api.get(ENDPOINTS.AUTH.ME);
        const freshUserData = response.data as User;

        const userWithToken: User = {
          ...freshUserData,
          token,
          refresh_token: localStorage.getItem('refresh_token') || undefined,
        };

        setUser(userWithToken);
      } catch (error) {
        console.warn('Session verification failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        setUser(null);
      } finally {
        setBootstrapped(true);
      }
    };

    checkExistingSession();
  }, [decodeTokenExpiry]);

  const login = useCallback(
    (userData: User) => {
      applyLoginState(userData);
      sendAuthMessage({ type: 'login', payload: { user: userData } });
    },
    [applyLoginState, sendAuthMessage]
  );

  // --- UPDATE: Improved logout to call backend and ensure clean client state ---
  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('refresh_token');

    clearAuthState();
    sendAuthMessage({ type: 'logout' });

    if (refreshToken) {
      api.post(ENDPOINTS.AUTH.LOGOUT, { refresh_token: refreshToken }).catch(err => {
        console.warn("Backend logout call failed. Client is already logged out.", err);
      });
    }

    // For a manual logout, explicitly redirect to the login page to ensure
    // a clean state, rather than relying solely on the interceptor.
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, [clearAuthState, sendAuthMessage]);

  useEffect(() => {
    const handleForcedLogout = () => logout();
    window.addEventListener('auth-logout', handleForcedLogout);
    return () => {
      window.removeEventListener('auth-logout', handleForcedLogout);
    };
  }, [logout]);

  useEffect(() => {
    const handleTokenRefreshed = (event: Event) => {
      const customEvent = event as CustomEvent<{ accessToken?: string; refreshToken?: string }>;
      const newToken = customEvent.detail?.accessToken;
      const newRefreshToken = customEvent.detail?.refreshToken;
      if (!newToken) {
        return;
      }

      clearCountdownTimers();
      setTokenExpiry(decodeTokenExpiry(newToken));
      setUser((prevUser) =>
        prevUser
          ? {
              ...prevUser,
              token: newToken,
              refresh_token: newRefreshToken ?? prevUser.refresh_token,
            }
          : prevUser
      );
      setTimeUntilExpiry(null);
    };

    window.addEventListener('auth-token-refreshed', handleTokenRefreshed);
    return () => {
      window.removeEventListener('auth-token-refreshed', handleTokenRefreshed);
    };
  }, [clearCountdownTimers, decodeTokenExpiry]);

  useEffect(() => {
    clearCountdownTimers();

    if (!tokenExpiry) {
      setTimeUntilExpiry(null);
      return;
    }

    const now = Date.now();
    const msUntilExpiry = tokenExpiry - now;

    if (msUntilExpiry <= 0) {
      logout();
      return;
    }

    const initialSeconds = Math.max(0, Math.ceil(msUntilExpiry / 1000));
    setTimeUntilExpiry(initialSeconds);

    logoutTimeoutRef.current = window.setTimeout(() => {
      logout();
    }, msUntilExpiry);

    countdownIntervalRef.current = window.setInterval(() => {
      setTimeUntilExpiry((prev) => {
        const remainingMs = tokenExpiry - Date.now();
        if (remainingMs <= 0) {
          if (countdownIntervalRef.current) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        const nextSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        if (nextSeconds === prev) {
          return prev ?? nextSeconds;
        }
        return nextSeconds;
      });
    }, 1000);

    return clearCountdownTimers;
  }, [tokenExpiry, logout, clearCountdownTimers]);

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      logout();
      throw new Error('No refresh token available');
    }

    const response = await api.post(ENDPOINTS.AUTH.REFRESH, {
      refresh_token: refreshToken,
    });

    const { access_token, refresh_token } = response.data;

    localStorage.setItem('token', access_token);
    localStorage.setItem('refresh_token', refresh_token);

    window.dispatchEvent(
      new CustomEvent('auth-token-refreshed', {
        detail: { accessToken: access_token, refreshToken: refresh_token },
      })
    );
  }, [logout]);

  const isTokenExpiringSoon =
    typeof timeUntilExpiry === 'number' && timeUntilExpiry <= 30 && timeUntilExpiry > 0;

  const value: AuthContextType = {
    user,
    login,
    logout,
    bootstrapped,
    refreshAccessToken,
    timeUntilExpiry,
    isTokenExpiringSoon,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};