const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

// Export API_BASE_URL for use in image src and other URL constructions
export const API_URL = API_BASE_URL;

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

  // Don't set Content-Type for FormData - browser will set it automatically with boundary
  const isFormData = options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
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

// ==================== ACTIVITY LOGS ====================

export interface ActivityLog {
  id: number;
  userId: number | null;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'review' | 'approve';
  entityType: 'document' | 'foundation_instrument' | 'charter_section' | 'charter_article' | 'charter_sub_item' | 'committee_member' | 'group';
  entityId: number | null;
  groupId: number | null;
  stage: '03-pdf-label' | '04-extract' | '05-review';
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string | null;
  createdAt: string;
}

export interface ActivityLogsResponse {
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityLogsQuery {
  page?: number;
  limit?: number;
  userId?: number;
  groupId?: number;
  action?: string;
  entityType?: string;
  stage?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export async function getActivityLogs(query: ActivityLogsQuery = {}): Promise<ActivityLogsResponse> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value.toString());
    }
  });

  const response = await fetchWithAuth(`/activity-logs?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch activity logs');
  }

  return response.json();
}

// ==================== DISTRICTS API ====================

export interface DistrictOffice {
  id: number;
  name: string; // ชื่อสำนักงานเขต
  foundationName: string; // ชื่อมูลนิธิ
  registrationNumber: string; // เลข กท.
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DistrictOfficeListResponse {
  total: number;
  districtOffices: DistrictOffice[];
}

export interface DistrictOfficeResponse {
  districtOffice: DistrictOffice;
}

export interface CreateDistrictOfficeDto {
  name: string;
  foundationName: string;
  registrationNumber: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateDistrictOfficeDto {
  name?: string;
  foundationName?: string;
  registrationNumber?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

// Create district office
export async function createDistrictOffice(data: CreateDistrictOfficeDto): Promise<DistrictOfficeResponse> {
  const response = await fetchWithAuth('/districts', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Create failed' }));
    throw new Error(error.message || 'Create failed');
  }

  return response.json();
}

// Get all district offices
export async function getDistrictOffices(isActive?: boolean): Promise<DistrictOfficeListResponse> {
  const params = new URLSearchParams();
  if (isActive !== undefined) {
    params.append('active', isActive.toString());
  }

  const response = await fetchWithAuth(`/districts?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch district offices');
  }

  return response.json();
}

// Get single district office
export async function getDistrictOffice(id: number): Promise<DistrictOfficeResponse> {
  const response = await fetchWithAuth(`/districts/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch district office');
  }

  return response.json();
}

// Update district office
export async function updateDistrictOffice(
  id: number,
  data: UpdateDistrictOfficeDto
): Promise<DistrictOfficeResponse> {
  const response = await fetchWithAuth(`/districts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Update failed' }));
    throw new Error(error.message || 'Update failed');
  }

  return response.json();
}

// Delete district office
export async function deleteDistrictOffice(id: number): Promise<void> {
  const response = await fetchWithAuth(`/districts/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Delete failed' }));
    throw new Error(error.message || 'Delete failed');
  }
}
