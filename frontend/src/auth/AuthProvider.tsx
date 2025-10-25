// src/auth/AuthProvider.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types'; // Assuming 'User' type is defined in your project
import { api, ENDPOINTS } from '../api/config';

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

  // Check for an existing session on app startup
  useEffect(() => {
    const checkExistingSession = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setBootstrapped(true);
        return;
      }

      try {
        // Verify the token by fetching current user data from the backend
        // --- FIX: Updated endpoint from ENDPOINTS.USERS.ME to ENDPOINTS.AUTH.ME ---
        const response = await api.get(ENDPOINTS.AUTH.ME);
        const freshUserData = response.data as User;
        
        // Add the existing token to the user object for consistency
        const userWithToken: User = {
          ...freshUserData,
          token
        };
        
        setUser(userWithToken);
      } catch (error) {
        // The API interceptor will handle 401s by redirecting to login.
        // This catch block is a safeguard for other potential errors.
        console.warn('Session verification failed:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        // Mark the initial check as complete to allow the app to render
        setBootstrapped(true);
      }
    };

    checkExistingSession();
  }, []);

  const login = (userData: User) => {
    if (userData.token) {
      localStorage.setItem('token', userData.token);
    }
    setUser(userData);
  };

  // --- UPDATE: Improved logout to call backend and ensure clean client state ---
  const logout = () => {
    // Immediately clear the user's token and state on the client.
    localStorage.removeItem('token');
    setUser(null);

    // Inform the backend that the user is logging out.
    // This is a "fire and forget" call; we don't block the client-side
    // logout waiting for the response.
    api.post(ENDPOINTS.AUTH.LOGOUT).catch(err => {
        console.warn("Backend logout call failed. Client is already logged out.", err);
    });

    // For a manual logout, explicitly redirect to the login page to ensure
    // a clean state, rather than relying solely on the interceptor.
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    bootstrapped
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};