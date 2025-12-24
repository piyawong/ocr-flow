'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirstAccessibleStage, hasStageAccess } from '@/lib/api';

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
      const firstStage = getFirstAccessibleStage(user);
      if (firstStage) {
        router.push(firstStage); // Redirect to first accessible stage
      } else {
        router.push('/login'); // No accessible stage, go back to login
      }
      return;
    }

    // Check if user has access to current stage
    if (user && pathname.startsWith('/stages/')) {
      const hasAccess = hasStageAccess(user, pathname);

      if (!hasAccess) {
        // User doesn't have access to this stage, redirect to first accessible stage
        const firstStage = getFirstAccessibleStage(user);

        if (firstStage && firstStage !== pathname) {
          router.push(firstStage);
        } else if (!firstStage) {
          // No accessible stage at all, redirect to login
          router.push('/login');
        }
        return;
      }
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
