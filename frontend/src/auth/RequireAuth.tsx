import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Optional: For more granular control if needed
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, allowedRoles }) => {
  const { user, bootstrapped } = useAuth();
  const location = useLocation();

  // Wait until the auth state is checked from localStorage
  if (!bootstrapped) {
    return <div>Loading...</div>; // Or a spinner component
  }

  // If user is not logged in, redirect to login page
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Optional: Check if the user's role is allowed for this route
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to a "not authorized" page or back to their dashboard
    return <Navigate to="/" replace />; 
  }

  return <>{children}</>;
};