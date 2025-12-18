'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { initAdmin } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initMessage, setInitMessage] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/stages/01-raw');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push('/stages/01-raw');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitAdmin = async () => {
    try {
      const result = await initAdmin();
      if (result.email) {
        setInitMessage(`Admin created! Email: ${result.email}, Password: ${result.defaultPassword}`);
        setEmail(result.email);
        setPassword(result.defaultPassword || 'admin123');
      } else {
        setInitMessage(result.message);
      }
    } catch (err) {
      setInitMessage('Failed to initialize admin');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-md">
        <div className="bg-card-bg rounded-2xl shadow-lg border border-border-color p-8">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-accent mb-2">OCR Flow</h1>
            <p className="text-text-secondary">Document Processing System</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-danger-light border border-danger text-danger rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            {initMessage && (
              <div className="bg-success-light border border-success text-success rounded-lg p-3 text-sm">
                {initMessage}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-bg-secondary border border-border-color rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                placeholder="Enter your email"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-bg-secondary border border-border-color rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                placeholder="Enter your password"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-accent to-[#2563eb] text-white font-semibold rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Init Admin Button (for first time setup) */}
          <div className="mt-6 pt-6 border-t border-border-color">
            <p className="text-text-secondary text-sm text-center mb-3">
              First time setup?
            </p>
            <button
              onClick={handleInitAdmin}
              className="w-full py-2 px-4 bg-bg-secondary border border-border-color text-text-secondary font-medium rounded-lg hover:bg-hover-bg hover:border-accent transition-all text-sm"
            >
              Create Default Admin User
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-text-secondary text-sm mt-4">
          OCR Flow v2 - Document Processing System
        </p>
      </div>
    </div>
  );
}
