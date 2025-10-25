// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/RequireAuth';

// Import all your page components
import Login from '../pages/Login';
import ForgotPassword from '../components/Forgotpassword';  // Add this import
import ResetPassword from '../components/ResetPassword';    // Add this import
import AdminDashboard from '../pages/AdminDashboard';
import EngineerPortal from '../pages/EngineerPortal';
import CustomerPortal from '../pages/CustomerPortal';
import { CustomerRemarksPortal } from '../components/CustomerRemarksPortal';

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
  const { logout, user } = useAuth();

  return (
    <Routes>
      {/* --- Public Routes --- */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />  {/* Add this route */}
      <Route path="/reset-password" element={<ResetPassword />} />    {/* Add this route */}
      
      {/* --- Customer Remarks Portal (Public with token authentication) --- */}
      <Route path="/portal/inwards/:inwardId/remarks" element={<CustomerRemarksPortal />} />
      
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