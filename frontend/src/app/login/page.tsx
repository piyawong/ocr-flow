'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { initAdmin } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { LoadingState } from '@/components/ui/Spinner';

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
        <LoadingState text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary via-accent/5 to-purple-500/10 p-4">
      <div className="w-full max-w-md">
        <Card padding="lg" className="shadow-2xl bg-card-bg/95 backdrop-blur-md border-border-color/50">
          {/* Logo / Header */}
          <CardHeader className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center shadow-xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              OCR Flow
            </h1>
            <p className="text-text-secondary">Document Processing System</p>
          </CardHeader>

          <CardContent>
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="danger" dismissible onDismiss={() => setError('')}>
                  {error}
                </Alert>
              )}

              {initMessage && (
                <Alert variant="success" dismissible onDismiss={() => setInitMessage('')}>
                  {initMessage}
                </Alert>
              )}

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isSubmitting}
                required
                leftIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                }
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isSubmitting}
                required
                leftIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isSubmitting}
                className="shadow-lg shadow-accent/20"
              >
                Sign In
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col border-t border-border-color/30 mt-6 pt-6">
            <p className="text-text-secondary text-sm text-center mb-3 font-medium">
              First time setup?
            </p>
            <Button
              variant="outline"
              fullWidth
              onClick={handleInitAdmin}
              className="border-accent/30 hover:border-accent hover:bg-accent/10 transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Create Default Admin User
            </Button>
          </CardFooter>
        </Card>

        {/* Footer */}
        <p className="text-center text-text-secondary text-sm mt-6 font-medium">
          OCR Flow v2 - Document Processing System
        </p>
      </div>
    </div>
  );
}
