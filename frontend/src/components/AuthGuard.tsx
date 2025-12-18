'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

export default function AuthGuard({
  children,
  requireAuth = true,
  requireAdmin = false
}: AuthGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    // If auth is required but user is not authenticated
    if (requireAuth && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // If admin is required but user is not admin
    if (requireAdmin && user?.role !== 'admin') {
      router.push('/stages/01-raw'); // Redirect to main page
      return;
    }
  }, [isLoading, isAuthenticated, requireAuth, requireAdmin, user, router, pathname]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is required but user is not authenticated, show nothing (will redirect)
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  // If admin is required but user is not admin, show nothing (will redirect)
  if (requireAdmin && user?.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}
