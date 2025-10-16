// src/auth/AuthProvider.tsx

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types';

// --- Mock Session Validation API (No Change) ---
async function validateSession(token: string): Promise<User> {
  console.log("Validating token...", token);
  await new Promise(res => setTimeout(res, 300)); 

  if (token === 'fake-admin-token') {
    return { user_id: 1, email: 'admin@lims.com', role: 'admin', username: 'Admin User', full_name: 'Admin User', customer_id: null, is_active: true, token };
  }
  if (token === 'fake-engineer-token') {
    return { user_id: 2, email: 'engineer1@lims.com', role: 'engineer', username: 'Engineer User', full_name: 'Engineer User', customer_id: null, is_active: true, token };
  }
  if (token === 'fake-customer-token') {
    return { user_id: 3, email: 'customerA@company.com', role: 'customer', username: 'Customer User', full_name: 'Customer User', customer_id: 101, is_active: true, token };
  }
  // This is the line that throws "Invalid session token"
  throw new Error("Invalid session token"); 
}
// --- End Mock API ---


interface AuthContextType {
// ... (Interface is unchanged)
  user: User | null;
  bootstrapped: boolean;
  login: (userData: User) => void;
  logout: () => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 🛠️ FIX: Correctly type the props object for AuthProvider
interface AuthProviderProps {
    children: ReactNode;
}

// 🛠️ FIX: Use the correct AuthProviderProps interface
export const AuthProvider = ({ children }: AuthProviderProps) => { 
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // 🛑 FIX 1: Clear the 'token' key, not the 'user' key.
  const logout = useCallback(() => {
    localStorage.removeItem('token'); 
    setUser(null);
    console.log("Successfully logged out and cleared state.");
  }, []); 

  // 🛑 FIX 2: Store only the token string under the 'token' key.
  const login = useCallback((userData: User) => {
    if (userData.token) {
      localStorage.setItem('token', userData.token); // Store token string
      setUser(userData);
    } else {
      console.error("Login attempt failed: User data missing token.");
      logout(); // Ensure user is not set if no token
    }
  }, [logout]); 

  useEffect(() => {
    const checkUserSession = async () => {
      // 🛑 FIX 3: Get the token string directly.
      const storedToken = localStorage.getItem('token'); 
      
      if (storedToken) {
        try {
          const freshUserData = await validateSession(storedToken); 
          setUser(freshUserData);
        } catch (error) {
          // This catches the "Invalid session token" error
          console.error("Session validation failed during bootstrapping:", error);
          logout(); 
        }
      }
      
      setBootstrapped(true);
    };

    checkUserSession();
    
  }, [logout]); 

  const value = { user, bootstrapped, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ... (useAuth is unchanged)
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};