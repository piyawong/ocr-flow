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

// ==================== ORGANIZATIONS API ====================

export interface Organization {
  id: number;
  districtOfficeName: string; // สำนักงานเขต
  name: string; // ชื่อองค์กร
  type: string; // ประเภท: "สมาคม" | "มูลนิธิ"
  registrationNumber: string; // เลข กท.
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  matchedGroupId: number | null; // FK to groups.id
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationListResponse {
  total: number;
  organizations: Organization[];
}

export interface OrganizationResponse {
  organization: Organization;
}

export interface CreateOrganizationDto {
  districtOfficeName: string;
  name: string;
  type: string;
  registrationNumber: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  matchedGroupId?: number;
}

export interface UpdateOrganizationDto {
  districtOfficeName?: string;
  name?: string;
  type?: string;
  registrationNumber?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  matchedGroupId?: number;
}

// Create organization
export async function createOrganization(data: CreateOrganizationDto): Promise<OrganizationResponse> {
  const response = await fetchWithAuth('/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Create failed' }));
    throw new Error(error.message || 'Create failed');
  }

  return response.json();
}

// Get all organizations
export async function getOrganizations(isActive?: boolean): Promise<OrganizationListResponse> {
  const params = new URLSearchParams();
  if (isActive !== undefined) {
    params.append('active', isActive.toString());
  }

  const response = await fetchWithAuth(`/organizations?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch organizations');
  }

  return response.json();
}

// Get single organization
export async function getOrganization(id: number): Promise<OrganizationResponse> {
  const response = await fetchWithAuth(`/organizations/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch organization');
  }

  return response.json();
}

// Update organization
export async function updateOrganization(
  id: number,
  data: UpdateOrganizationDto
): Promise<OrganizationResponse> {
  const response = await fetchWithAuth(`/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Update failed' }));
    throw new Error(error.message || 'Update failed');
  }

  return response.json();
}

// Delete organization
export async function deleteOrganization(id: number): Promise<void> {
  const response = await fetchWithAuth(`/organizations/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Delete failed' }));
    throw new Error(error.message || 'Delete failed');
  }
}

// Sync organizations to OCR service
export async function syncOrganizationsToOcr(): Promise<{ success: boolean; count: number; message: string }> {
  const response = await fetchWithAuth('/organizations/sync-to-ocr', {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Sync failed' }));
    throw new Error(error.message || 'Sync failed');
  }

  return response.json();
}

// Get organizations from OCR service (bypass backend, call OCR service directly)
export async function getOrganizationsFromOcrService(): Promise<{ organizations: string[]; count: number }> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';
  const OCR_SERVICE_URL = API_URL.replace(':4004', ':8000').replace('4004', '8000');

  const response = await fetch(`${OCR_SERVICE_URL}/organizations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch organizations from OCR service');
  }

  return response.json();
}

// ==================== USER STAGE ACCESS UTILITY ====================

/**
 * Get the first accessible stage for a user based on their role and permissions
 * @param user - User object with role and permissions
 * @returns Path to the first accessible stage (e.g., '/stages/03-pdf-label') or null if no access
 */
export function getFirstAccessibleStage(user: User | null): string | null {
  // No user = no access
  if (!user) {
    return null;
  }

  // Admin can access all stages - start from stage 00
  if (user.role === 'admin') {
    return '/stages/00-upload';
  }

  // For regular users, only stages with specific permissions are accessible
  // Define stage access requirements (in order of priority)
  const stageAccessMap: { stage: string; permission: string }[] = [
    { stage: '/stages/03-pdf-label', permission: StagePermission.STAGE_03_PDF_LABEL },
    { stage: '/stages/04-extract', permission: StagePermission.STAGE_04_EXTRACT },
    { stage: '/stages/05-review', permission: StagePermission.STAGE_05_REVIEW },
  ];

  // Get user permissions (default to empty array if not set)
  const userPermissions = user.permissions || [];

  // Find the first stage that the user has permission for
  for (const { stage, permission } of stageAccessMap) {
    if (userPermissions.includes(permission)) {
      return stage;
    }
  }

  // No accessible stage found
  return null;
}

/**
 * Check if user has access to a specific stage
 * @param user - User object with role and permissions
 * @param stagePath - Stage path (e.g., '/stages/03-pdf-label')
 * @returns true if user has access, false otherwise
 */
export function hasStageAccess(user: User | null, stagePath: string): boolean {
  if (!user) return false;

  // Admin can access all stages
  if (user.role === 'admin') {
    return true;
  }

  // For regular users, check specific stage permissions only
  const userPermissions = user.permissions || [];

  if (stagePath.includes('03-pdf-label')) {
    return userPermissions.includes(StagePermission.STAGE_03_PDF_LABEL);
  }

  if (stagePath.includes('04-extract')) {
    return userPermissions.includes(StagePermission.STAGE_04_EXTRACT);
  }

  if (stagePath.includes('05-review')) {
    return userPermissions.includes(StagePermission.STAGE_05_REVIEW);
  }

  // Stage 01, 02, 06 are admin-only
  // Regular users cannot access these stages
  return false;
}
