import { useAuth } from '@/contexts/AuthContext';
import { StagePermission } from '@/lib/api';

export function usePermission() {
  const { user } = useAuth();

  const hasPermission = (permission: string): boolean => {
    // Admin has all permissions
    if (user?.role === 'admin') {
      return true;
    }

    // Check if user has the specific permission
    return user?.permissions?.includes(permission) || false;
  };

  const canAccessStage03 = (): boolean => {
    return hasPermission(StagePermission.STAGE_03_PDF_LABEL);
  };

  const canAccessStage04 = (): boolean => {
    return hasPermission(StagePermission.STAGE_04_EXTRACT);
  };

  const canAccessStage05 = (): boolean => {
    return hasPermission(StagePermission.STAGE_05_REVIEW);
  };

  return {
    hasPermission,
    canAccessStage03,
    canAccessStage04,
    canAccessStage05,
  };
}
