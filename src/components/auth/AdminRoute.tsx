import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ADMIN_EMAIL = 'mehran.rajaian@gmail.com';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>;
  }

  if (!isAuthenticated || user?.email !== ADMIN_EMAIL) {
    return <Navigate to="/trips" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute; 