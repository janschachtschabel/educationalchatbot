import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../lib/auth';
import { Bot } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, allowedRoles, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Bot className="h-12 w-12 text-indigo-600 animate-bounce" />
      </div>
    );
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
    return (
      <div className="p-8 text-center bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-red-600 mb-2">Account Blocked</h2>
        <p className="text-gray-600">Please contact an administrator for assistance.</p>
      </div>
    );
  }

  return <>{children}</>;
}