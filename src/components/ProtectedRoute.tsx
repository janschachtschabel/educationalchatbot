import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, allowedRoles, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuthStore();

  if (!initialized || loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (user.is_blocked) {
    return <div className="p-4 text-center">
      <h2 className="text-xl font-bold text-red-600">Account Blocked</h2>
      <p className="text-gray-600">Please contact an administrator for assistance.</p>
    </div>;
  }

  return <>{children}</>;
}