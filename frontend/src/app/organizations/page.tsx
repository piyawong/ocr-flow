'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DistrictOfficeCombobox } from '@/components/shared/DistrictOfficeCombobox';
import {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getMe,
  type Organization,
  type CreateOrganizationDto,
} from '@/lib/api';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<string>('user');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'มูลนิธิ' | 'สมาคม'>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState<CreateOrganizationDto>({
    districtOfficeName: '',
    name: '',
    type: 'มูลนิธิ',
    registrationNumber: '',
    description: '',
    displayOrder: 0,
    isActive: true,
    matchedGroupId: undefined,
  });

  // Check user role
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getMe();
        setUserRole(user.role);
        if (user.role !== 'admin') {
          setError('Access denied. Admin only.');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      }
    };
    checkAuth();
  }, []);

  // Fetch organizations
  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOrganizations();
      setOrganizations(data.organizations);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchOrganizations();
    }
  }, [fetchOrganizations, userRole]);

  // Open create modal
  const handleOpenCreateModal = () => {
    setEditingOrganization(null);
    setFormData({
      districtOfficeName: '',
      name: '',
      type: 'มูลนิธิ',
      registrationNumber: '',
      description: '',
      displayOrder: 0,
      isActive: true,
      matchedGroupId: undefined,
    });
    setShowFormModal(true);
  };

  // Open edit modal
  const handleOpenEditModal = (organization: Organization) => {
    setEditingOrganization(organization);
    setFormData({
      districtOfficeName: organization.districtOfficeName,
      name: organization.name,
      type: organization.type,
      registrationNumber: organization.registrationNumber,
      description: organization.description || '',
      displayOrder: organization.displayOrder,
      isActive: organization.isActive,
      matchedGroupId: organization.matchedGroupId || undefined,
    });
    setShowFormModal(true);
  };

  // Handle save (create or update)
  const handleSave = async () => {
    // Validation
    if (!formData.districtOfficeName.trim() || !formData.name.trim() || !formData.registrationNumber.trim()) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingOrganization) {
        // Update existing
        await updateOrganization(editingOrganization.id, formData);
      } else {
        // Create new
        await createOrganization(formData);
      }

      setShowFormModal(false);
      await fetchOrganizations();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Filter and search organizations
  const getFilteredOrganizations = useCallback(() => {
    let result = [...organizations];

    // Filter by status
    if (statusFilter === 'active') {
      result = result.filter(o => o.isActive);
    } else if (statusFilter === 'inactive') {
      result = result.filter(o => !o.isActive);
    }

    // Filter by type
    if (typeFilter !== 'all') {
      result = result.filter(o => o.type === typeFilter);
    }

    // Filter by district (districtOfficeName)
    if (districtFilter !== 'all') {
      result = result.filter(o => o.districtOfficeName === districtFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.districtOfficeName.toLowerCase().includes(query) ||
        o.name.toLowerCase().includes(query) ||
        o.registrationNumber.toLowerCase().includes(query) ||
        (o.description && o.description.toLowerCase().includes(query))
      );
    }

    return result;
  }, [organizations, statusFilter, typeFilter, districtFilter, searchQuery]);

  // Handle delete
  const handleDelete = async (id: number) => {
    try {
      setDeleting(true);
      await deleteOrganization(id);
      setDeleteId(null);
      await fetchOrganizations();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const filteredOrganizations = getFilteredOrganizations();

  if (userRole !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="danger">Access denied. Admin only.</Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Organization Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            จัดการข้อมูลองค์กรและเลข กท.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} variant="primary">
          + Add Organization
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search & Filter Bar */}
      {!loading && organizations.length > 0 && (
        <div className="mb-4 flex flex-col gap-4">
          {/* First Row: Search Box + Filters + Add Button */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Box */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 ค้นหาตามชื่อ, กลุ่ม หรือเลข กท...."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Type Filter Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'มูลนิธิ' | 'สมาคม')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white min-w-[120px]"
            >
              <option value="all">ทั้งหมด</option>
              <option value="มูลนิธิ">มูลนิธิ</option>
              <option value="สมาคม">สมาคม</option>
            </select>

            {/* District Filter Dropdown */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white min-w-[150px]"
            >
              <option value="all">เขต: ทั้งหมด</option>
              {Array.from(new Set(organizations.map(o => o.districtOfficeName)))
                .sort()
                .map((districtOfficeName) => (
                  <option key={districtOfficeName} value={districtOfficeName}>
                    {districtOfficeName}
                  </option>
                ))}
            </select>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white min-w-[120px]"
            >
              <option value="all">สถานะ: ทั้งหมด</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && organizations.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No organizations found</p>
          <Button onClick={handleOpenCreateModal} variant="primary">
            + Add First Organization
          </Button>
        </div>
      )}

      {/* No Results After Filter */}
      {!loading && organizations.length > 0 && filteredOrganizations.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-500 dark:text-gray-400">
            No results found for "{searchQuery}"
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="mt-2"
          >
            Clear Search
          </Button>
        </div>
      )}

      {/* Table */}
      {!loading && filteredOrganizations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 shadow rounded-lg">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  สำนักงานเขต
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  ชื่อองค์กร
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  ประเภท
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  เลข กท.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  หมายเลขกลุ่มที่ match
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrganizations.map((organization, idx) => (
                <tr
                  key={organization.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {organization.districtOfficeName}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {organization.name}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {organization.type === 'มูลนิธิ' ? (
                      <Badge variant="default" className="bg-blue-500/10 text-blue-400">
                        {organization.type}
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500/10 text-green-400">
                        {organization.type}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {organization.registrationNumber}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {organization.matchedGroupId || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {organization.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="default">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenEditModal(organization)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteId(organization.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showFormModal} onClose={() => !saving && setShowFormModal(false)}>
        <ModalHeader>
          <ModalTitle>{editingOrganization ? 'Edit Organization' : 'Add Organization'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* สำนักงานเขต - Combobox */}
            <div>
              <label className="block text-sm font-medium mb-2">
                สำนักงานเขต <span className="text-red-500">*</span>
              </label>
              <DistrictOfficeCombobox
                value={formData.districtOfficeName}
                onChange={(value) => setFormData({ ...formData, districtOfficeName: value })}
                placeholder="พิมพ์หรือเลือกจากรายการ (เช่น สำนักงานเขตจอมทอง)"
                className="w-full"
                disabled={saving}
              />
            </div>

            {/* ชื่อองค์กร */}
            <Input
              label="ชื่อองค์กร"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="เช่น มูลนิธิจอมทอง"
              required
            />

            {/* ประเภท */}
            <div>
              <label className="block text-sm font-medium mb-2">
                ประเภท <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="มูลนิธิ">มูลนิธิ</option>
                <option value="สมาคม">สมาคม</option>
              </select>
            </div>

            {/* เลข กท. */}
            <Input
              label="เลข กท."
              type="text"
              value={formData.registrationNumber}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
              placeholder="เช่น 30"
              required
            />

            {/* คำอธิบาย (optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">คำอธิบาย (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="รายละเอียดเพิ่มเติม..."
              />
            </div>

            {/* หมายเลขกลุ่มที่ match (optional) */}
            <Input
              label="หมายเลขกลุ่มที่ match (Optional)"
              type="number"
              value={formData.matchedGroupId?.toString() || ''}
              onChange={(e) => setFormData({ ...formData, matchedGroupId: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="เช่น 1"
            />

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-sm font-medium">Active</label>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowFormModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingOrganization ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete Organization"
        description="Are you sure you want to delete this organization? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />
    </div>
  );
}
