const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

// Token storage keys
const ACCESS_TOKEN_KEY = 'ocr-flow-access-token';

// Get stored token
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

// Store token
export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

// Remove token
export function removeAccessToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// API request with auth header
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - token expired or invalid
  if (response.status === 401) {
    removeAccessToken();
    // Redirect to login if not already there
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  return response;
}

// Auth API functions
export interface LoginRequest {
  email: string;
  password: string;
}

// Stage permissions enum (must match backend)
export const StagePermission = {
  STAGE_03_PDF_LABEL: 'stage_03_pdf_label',
  STAGE_04_EXTRACT: 'stage_04_extract',
  STAGE_05_REVIEW: 'stage_05_review',
} as const;

export type StagePermissionType = typeof StagePermission[keyof typeof StagePermission];

export interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    permissions: string[];
  };
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
  permissions?: string[];
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || 'Login failed');
  }

  return response.json();
}

export async function register(data: RegisterRequest): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(error.message || 'Registration failed');
  }

  return response.json();
}

export async function getMe(): Promise<User> {
  const response = await fetchWithAuth('/auth/me');

  if (!response.ok) {
    throw new Error('Failed to get user profile');
  }

  return response.json();
}

export interface UpdateProfileRequest {
  name?: string;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<User> {
  const response = await fetchWithAuth('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update profile' }));
    throw new Error(error.message || 'Failed to update profile');
  }

  return response.json();
}

export async function getAllUsers(): Promise<User[]> {
  const response = await fetchWithAuth('/auth/users');

  if (!response.ok) {
    throw new Error('Failed to get users');
  }

  return response.json();
}

export async function initAdmin(): Promise<{ message: string; email?: string; defaultPassword?: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/init-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to initialize admin');
  }

  return response.json();
}

// Admin functions
export async function deleteUser(id: number): Promise<void> {
  const response = await fetchWithAuth(`/auth/users/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete user' }));
    throw new Error(error.message || 'Failed to delete user');
  }
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  isActive?: boolean;
  permissions?: string[];
}

export async function updateUser(id: number, data: UpdateUserRequest): Promise<User> {
  const response = await fetchWithAuth(`/auth/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update user' }));
    throw new Error(error.message || 'Failed to update user');
  }

  return response.json();
}
