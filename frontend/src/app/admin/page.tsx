'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  User,
  getAllUsers,
  register,
  deleteUser,
  updateUser,
  RegisterRequest,
  StagePermission
} from '@/lib/api';

// Permission labels for display
const PERMISSION_LABELS: Record<string, string> = {
  [StagePermission.STAGE_03_PDF_LABEL]: '03 - PDF Label',
  [StagePermission.STAGE_04_EXTRACT]: '04 - Extract',
  [StagePermission.STAGE_05_REVIEW]: '05 - Review',
};

const ALL_PERMISSIONS = Object.values(StagePermission);

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for new user
  const [newUser, setNewUser] = useState<RegisterRequest>({
    name: '',
    email: '',
    password: '',
    role: 'user',
    permissions: [],
  });

  // Form state for editing user
  const [editUser, setEditUser] = useState<{
    permissions: string[];
  }>({
    permissions: [],
  });

  // Check if user is admin
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Fetch users
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await register(newUser);
      await fetchUsers();
      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'user', permissions: [] });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await deleteUser(selectedUser.id);
      await fetchUsers();
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await updateUser(selectedUser.id, {
        permissions: editUser.permissions,
      });
      await fetchUsers();
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (userToDelete: User) => {
    setSelectedUser(userToDelete);
    setShowDeleteModal(true);
  };

  const openEditModal = (userToEdit: User) => {
    setSelectedUser(userToEdit);
    setEditUser({
      permissions: userToEdit.permissions || [],
    });
    setShowEditModal(true);
  };

  const toggleNewUserPermission = (permission: string) => {
    setNewUser(prev => ({
      ...prev,
      permissions: prev.permissions?.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...(prev.permissions || []), permission],
    }));
  };

  const toggleEditUserPermission = (permission: string) => {
    setEditUser(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  // Don't render if not admin
  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  // Filter out admin users (can't delete admins)
  const nonAdminUsers = users.filter(u => u.role !== 'admin');
  const adminUsers = users.filter(u => u.role === 'admin');

  return (
    <div className="min-h-screen bg-bg-primary p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">User Management</h1>
            <p className="text-text-secondary mt-1">Manage users and their permissions</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-danger-light border border-danger rounded-lg text-danger">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card-bg border border-border-color rounded-xl p-6">
            <div className="text-3xl font-bold text-text-primary">{users.length}</div>
            <div className="text-text-secondary">Total Users</div>
          </div>
          <div className="bg-card-bg border border-border-color rounded-xl p-6">
            <div className="text-3xl font-bold text-accent">{adminUsers.length}</div>
            <div className="text-text-secondary">Admins</div>
          </div>
          <div className="bg-card-bg border border-border-color rounded-xl p-6">
            <div className="text-3xl font-bold text-green-500">{nonAdminUsers.length}</div>
            <div className="text-text-secondary">Regular Users</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card-bg border border-border-color rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-color">
            <h2 className="text-lg font-semibold text-text-primary">All Users</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-text-secondary">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">No users found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-hover-bg transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                          <span className="text-accent font-medium text-sm">
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-text-primary font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-text-secondary">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-green-500/20 text-green-500'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.role === 'admin' ? (
                        <span className="text-text-secondary text-sm">All access</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.permissions && u.permissions.length > 0 ? (
                            u.permissions.map(p => (
                              <span key={p} className="px-2 py-0.5 bg-blue-500/20 text-blue-500 rounded text-xs">
                                {PERMISSION_LABELS[p] || p}
                              </span>
                            ))
                          ) : (
                            <span className="text-text-secondary text-sm">No permissions</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.isActive !== false
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}>
                        {u.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => openEditModal(u)}
                              className="text-accent hover:text-accent/80 transition-colors p-2"
                              title="Edit permissions"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => openDeleteModal(u)}
                              className="text-danger hover:text-danger/80 transition-colors p-2"
                              title="Delete user"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-card-bg p-8 rounded-2xl max-w-md w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-border-color max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-text-primary mb-6">Add New User</h2>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border-color bg-bg-secondary text-text-primary rounded-lg focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border-color bg-bg-secondary text-text-primary rounded-lg focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border-color bg-bg-secondary text-text-primary rounded-lg focus:outline-none focus:border-accent"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border-color bg-bg-secondary text-text-primary rounded-lg focus:outline-none focus:border-accent"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {newUser.role === 'user' && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Stage Permissions</label>
                  <div className="space-y-2">
                    {ALL_PERMISSIONS.map(permission => (
                      <label key={permission} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.permissions?.includes(permission) || false}
                          onChange={() => toggleNewUserPermission(permission)}
                          className="w-4 h-4 rounded border-border-color text-accent focus:ring-accent"
                        />
                        <span className="text-text-primary">{PERMISSION_LABELS[permission]}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-text-secondary mt-2">Select stages this user can access</p>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-border-color text-text-primary rounded-lg hover:bg-hover-bg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-card-bg p-8 rounded-2xl max-w-md w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-border-color"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-text-primary mb-2">Edit Permissions</h2>
            <p className="text-text-secondary mb-6">{selectedUser.name} ({selectedUser.email})</p>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-3">Stage Permissions</label>
                <div className="space-y-3">
                  {ALL_PERMISSIONS.map(permission => (
                    <label key={permission} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border-color hover:bg-hover-bg transition-colors">
                      <input
                        type="checkbox"
                        checked={editUser.permissions.includes(permission)}
                        onChange={() => toggleEditUserPermission(permission)}
                        className="w-5 h-5 rounded border-border-color text-accent focus:ring-accent"
                      />
                      <span className="text-text-primary font-medium">{PERMISSION_LABELS[permission]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3 bg-border-color text-text-primary rounded-lg hover:bg-hover-bg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-card-bg p-8 rounded-2xl max-w-md w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-border-color"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">Delete User</h2>
              <p className="text-text-secondary mb-6">
                Are you sure you want to delete <strong className="text-text-primary">{selectedUser.name}</strong>?
                This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 bg-border-color text-text-primary rounded-lg hover:bg-hover-bg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-danger text-white rounded-lg hover:bg-danger/90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
