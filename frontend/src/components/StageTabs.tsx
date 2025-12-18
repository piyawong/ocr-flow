'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { StagePermission } from '@/lib/api';

interface Stage {
  id: string;
  label: string;
  href: string;
  permission?: string; // Permission required for this stage
}

const allStages: Stage[] = [
  { id: '01', label: 'Raw Images', href: '/stages/01-raw' },
  { id: '02', label: 'Group', href: '/stages/02-group' },
  { id: '03', label: 'PDF Label', href: '/stages/03-pdf-label', permission: StagePermission.STAGE_03_PDF_LABEL },
  { id: '04', label: 'Extract Data', href: '/stages/04-extract', permission: StagePermission.STAGE_04_EXTRACT },
  { id: '05', label: 'Review', href: '/stages/05-review', permission: StagePermission.STAGE_05_REVIEW },
  { id: '06', label: 'Upload', href: '/stages/06-upload' },
];

export default function StageTabs() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasPermission } = usePermission();

  // Filter stages based on user role and permissions
  const visibleStages = allStages.filter(stage => {
    // Admin sees all stages
    if (user?.role === 'admin') {
      return true;
    }

    // Regular users only see stages they have permission for
    // If stage has no permission requirement, hide it for regular users
    if (!stage.permission) {
      return false;
    }

    return hasPermission(stage.permission);
  });

  return (
    <div className="bg-card-bg border-b border-border-color py-4 px-8">
      <div className="flex gap-3 max-w-[1400px] mx-auto overflow-x-auto">
        {visibleStages.map((stage) => {
          const isActive = pathname === stage.href || pathname.startsWith(stage.href + '/');

          return (
            <Link
              key={stage.id}
              href={stage.href}
              className={`
                flex items-center gap-2 px-4 py-2 border rounded-lg text-[0.9rem] whitespace-nowrap transition-all duration-200
                ${isActive
                  ? 'bg-accent border-accent text-white'
                  : 'bg-card-bg border-border-color text-text-primary hover:border-accent hover:bg-hover-bg'}
              `}
            >
              <span className="font-semibold">{stage.id}</span>
              {stage.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
