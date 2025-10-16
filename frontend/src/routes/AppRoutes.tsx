import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/RequireAuth';

// Import all your page components
import Login from '../pages/Login';
import AdminDashboard from '../pages/AdminDashboard';
import EngineerPortal from '../pages/EngineerPortal';
import CustomerPortal from '../pages/CustomerPortal';

const RootRedirect = () => {
  const { user, bootstrapped } = useAuth();
  
  if (!bootstrapped) {
    return <div>Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'engineer':
      return <Navigate to="/engineer" replace />;
    case 'customer':
      return <Navigate to="/customer" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

const AppRoutes = () => {
  // Corrected: Get both user and logout
  const { logout, user } = useAuth();

  return (
    <Routes>
      {/* --- Public Routes --- */}
      <Route path="/login" element={<Login />} />
      
      {/* --- Protected Routes --- */}
      <Route 
        path="/admin/*"
        element={
          <RequireAuth allowedRoles={['admin']}>
            <AdminDashboard />
          </RequireAuth>
        } 
      />
      <Route 
        path="/engineer/*"
        element={
          <RequireAuth allowedRoles={['engineer']}>
            {/* Corrected: Pass the 'user' prop down */}
            <EngineerPortal user={user} onLogout={logout} />
          </RequireAuth>
        } 
      />
      <Route 
        path="/customer/*"
        element={
          <RequireAuth allowedRoles={['customer']}>
            <CustomerPortal onLogout={logout} />
          </RequireAuth>
        } 
      />
      
      {/* --- Main Entry & Fallback Routes --- */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;