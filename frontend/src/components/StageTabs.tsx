'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const stages = [
  { id: '01', label: 'Raw Images', href: '/stages/01-raw' },
  { id: '02', label: 'Group', href: '/stages/02-group' },
  { id: '03', label: 'PDF Label', href: '/stages/03-pdf-label' },
  { id: '04', label: 'Extract Data', href: '/stages/04-extract' },
  { id: '05', label: 'Review', href: '/stages/05-review' },
  { id: '06', label: 'Upload', href: '/stages/06-upload' },
];

export default function StageTabs() {
  const pathname = usePathname();

  return (
    <div className="bg-card-bg border-b border-border-color py-4 px-8">
      <div className="flex gap-3 max-w-[1400px] mx-auto overflow-x-auto">
        {stages.map((stage) => {
          const isActive = pathname === stage.href;

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
