'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile, StagePermission } from '@/lib/api';
import { useState } from 'react';
import { usePermission } from '@/hooks/usePermission';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/stages', label: 'Stages' },
  { href: '/templates', label: 'Templates' },
];

const adminNavItems = [
  { href: '/admin', label: 'Admin' },
];

// Stage routes with their permissions
const stageRoutes = [
  { href: '/stages/01-raw', permission: null },
  { href: '/stages/02-group', permission: null },
  { href: '/stages/03-pdf-label', permission: StagePermission.STAGE_03_PDF_LABEL },
  { href: '/stages/04-extract', permission: StagePermission.STAGE_04_EXTRACT },
  { href: '/stages/05-review', permission: StagePermission.STAGE_05_REVIEW },
  { href: '/stages/06-upload', permission: null },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth();
  const { hasPermission } = usePermission();
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get the first available stage for the user based on permissions
  const getFirstAvailableStage = () => {
    if (user?.role === 'admin') {
      return '/stages/01-raw';
    }

    // For regular users, find first stage they have permission for
    for (const stage of stageRoutes) {
      if (stage.permission && hasPermission(stage.permission)) {
        return stage.href;
      }
    }

    // Default fallback (shouldn't happen if user has any permission)
    return '/stages/03-pdf-label';
  };

  const handleSaveName = async () => {
    const name = tempName.trim();
    if (!name) {
      return; // Don't save empty name
    }

    setIsSaving(true);
    try {
      await updateProfile({ name });
      await refreshUser(); // Refresh user data from database
      setShowNameModal(false);
      setTempName('');
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Failed to update name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenModal = () => {
    setTempName(user?.name || '');
    setShowNameModal(true);
  };

  const handleCloseModal = () => {
    setShowNameModal(false);
    setTempName('');
  };

  const isStagesActive = pathname.startsWith('/stages') || pathname.startsWith('/step-');

  // Don't show navbar on login page
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <>
      <nav className="flex items-center justify-between px-8 h-[60px] bg-nav-bg border-b border-border-color sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold text-accent no-underline">
            OCR Flow
          </Link>
          {isAuthenticated && (
            <ul className="flex list-none m-0 p-0 gap-1">
              {[...navItems, ...(user?.role === 'admin' ? adminNavItems : [])].map((item) => {
                const isActive = item.href === '/stages'
                  ? isStagesActive
                  : item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href === '/stages' ? getFirstAvailableStage() : item.href}
                      className={`
                        block px-4 py-2 text-[0.95rem] rounded-md transition-all duration-200 relative
                        ${isActive
                          ? 'text-accent after:content-[""] after:absolute after:bottom-[-18px] after:left-1/2 after:-translate-x-1/2 after:w-10 after:h-[3px] after:bg-accent after:rounded-t-md'
                          : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'}
                      `}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              {/* User Info & Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-accent-light rounded-md border border-accent hover:bg-accent/20 transition-all"
                >
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-[0.9rem] font-medium text-accent">{user.name}</span>
                  {user.role === 'admin' && (
                    <span className="px-1.5 py-0.5 bg-accent text-white text-[0.7rem] rounded font-medium">
                      Admin
                    </span>
                  )}
                  <svg className={`w-4 h-4 text-accent transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-card-bg rounded-lg shadow-lg border border-border-color overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-border-color">
                      <p className="text-sm font-medium text-text-primary">{user.name}</p>
                      <p className="text-xs text-text-secondary">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleOpenModal}
                        className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-hover-bg flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger-light flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : !isLoading && (
            <Link
              href="/login"
              className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent/90 transition-all"
            >
              Sign In
            </Link>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="bg-transparent border border-border-color px-2 py-1.5 rounded-md cursor-pointer text-base transition-all duration-200 hover:bg-hover-bg"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </nav>

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}

      {/* Name Setting Modal */}
      {showNameModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <div
            className="bg-card-bg p-8 rounded-2xl max-w-[400px] w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-border-color"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-4 text-xl text-text-primary">Set Reviewer Name</h2>
            <p className="my-2 text-text-secondary text-[0.9rem]">
              Your name will be saved with all labels you review.
            </p>

            <div className="mt-4">
              <label className="block mb-2 text-[0.9rem] font-medium text-text-primary">Name</label>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveName();
                  } else if (e.key === 'Escape') {
                    handleCloseModal();
                  }
                }}
                placeholder="Enter your name"
                className="w-full px-4 py-2.5 border border-border-color bg-bg-secondary text-text-primary rounded-md text-[0.95rem] transition-all duration-200 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),0.1)]"
                autoFocus
              />
            </div>

            <div className="flex gap-4 mt-6">
              <button
                className="flex-1 bg-border-color text-text-primary border-none px-6 py-3 rounded-lg text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 hover:bg-accent hover:text-white"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-gradient-to-br from-accent to-[#2563eb] text-white border-none px-6 py-3 rounded-lg text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSaveName}
                disabled={!tempName.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
