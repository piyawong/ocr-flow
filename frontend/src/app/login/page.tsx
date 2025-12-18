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
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-md">
        <Card padding="lg" className="shadow-lg">
          {/* Logo / Header */}
          <CardHeader className="text-center mb-4">
            <h1 className="text-3xl font-bold text-accent mb-2">OCR Flow</h1>
            <p className="text-text-secondary">Document Processing System</p>
          </CardHeader>

          <CardContent>
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
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
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isSubmitting}
                required
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isSubmitting}
              >
                Sign In
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col border-t border-border-color mt-6 pt-6">
            <p className="text-text-secondary text-sm text-center mb-3">
              First time setup?
            </p>
            <Button
              variant="outline"
              fullWidth
              onClick={handleInitAdmin}
            >
              Create Default Admin User
            </Button>
          </CardFooter>
        </Card>

        {/* Footer */}
        <p className="text-center text-text-secondary text-sm mt-4">
          OCR Flow v2 - Document Processing System
        </p>
      </div>
    </div>
  );
}
