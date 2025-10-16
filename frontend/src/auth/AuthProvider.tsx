// src/auth/AuthProvider.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
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
  bootstrapped: boolean;
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

  // Check for existing session on app startup
  useEffect(() => {
    const checkExistingSession = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setBootstrapped(true);
        return;
      }

      try {
        // Verify the token with the backend
        const response = await api.get(ENDPOINTS.USERS.ME);
        const freshUserData = response.data as User;
        
        // Add the token to the user data
        const userWithToken: User = {
          ...freshUserData,
          token
        };
        
        setUser(userWithToken);
      } catch (error) {
        console.warn('Session verification failed:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
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

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    bootstrapped
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};