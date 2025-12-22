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
  getDistrictOffices,
  createDistrictOffice,
  updateDistrictOffice,
  deleteDistrictOffice,
  getMe,
  type DistrictOffice,
  type CreateDistrictOfficeDto,
} from '@/lib/api';

export default function DistrictsPage() {
  const [districts, setDistricts] = useState<DistrictOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<DistrictOffice | null>(null);
  const [userRole, setUserRole] = useState<string>('user');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form state
  const [formData, setFormData] = useState<CreateDistrictOfficeDto>({
    name: '',
    foundationName: '',
    registrationNumber: '',
    description: '',
    displayOrder: 0,
    isActive: true,
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

  // Fetch districts
  const fetchDistricts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDistrictOffices();
      setDistricts(data.districtOffices);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch districts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchDistricts();
    }
  }, [fetchDistricts, userRole]);

  // Open create modal
  const handleOpenCreateModal = () => {
    setEditingDistrict(null);
    setFormData({
      name: '',
      foundationName: '',
      registrationNumber: '',
      description: '',
      displayOrder: 0,
      isActive: true,
    });
    setShowFormModal(true);
  };

  // Open edit modal
  const handleOpenEditModal = (district: DistrictOffice) => {
    setEditingDistrict(district);
    setFormData({
      name: district.name,
      foundationName: district.foundationName,
      registrationNumber: district.registrationNumber,
      description: district.description || '',
      displayOrder: district.displayOrder,
      isActive: district.isActive,
    });
    setShowFormModal(true);
  };

  // Handle save (create or update)
  const handleSave = async () => {
    // Validation
    if (!formData.name.trim() || !formData.foundationName.trim() || !formData.registrationNumber.trim()) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingDistrict) {
        // Update existing
        await updateDistrictOffice(editingDistrict.id, formData);
      } else {
        // Create new
        await createDistrictOffice(formData);
      }

      setShowFormModal(false);
      await fetchDistricts();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Filter and search districts
  const getFilteredDistricts = useCallback(() => {
    let result = [...districts];

    // Filter by status
    if (statusFilter === 'active') {
      result = result.filter(d => d.isActive);
    } else if (statusFilter === 'inactive') {
      result = result.filter(d => !d.isActive);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(query) ||
        d.foundationName.toLowerCase().includes(query) ||
        d.registrationNumber.toLowerCase().includes(query) ||
        (d.description && d.description.toLowerCase().includes(query))
      );
    }

    return result;
  }, [districts, statusFilter, searchQuery]);

  // Handle delete
  const handleDelete = async (id: number) => {
    try {
      setDeleting(true);
      await deleteDistrictOffice(id);
      setDeleteId(null);
      await fetchDistricts();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const filteredDistricts = getFilteredDistricts();

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
          <h1 className="text-3xl font-bold">District Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            จัดการข้อมูลสำนักงานเขตและเลข กท.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} variant="primary">
          + Add District
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search & Filter Bar */}
      {!loading && districts.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          {/* Search Box */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search by name, foundation, or registration number..."
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

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All ({districts.length})
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter('active')}
            >
              Active ({districts.filter(d => d.isActive).length})
            </Button>
            <Button
              variant={statusFilter === 'inactive' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter('inactive')}
            >
              Inactive ({districts.filter(d => !d.isActive).length})
            </Button>
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
      {!loading && districts.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No district offices found</p>
          <Button onClick={handleOpenCreateModal} variant="primary">
            + Add First District
          </Button>
        </div>
      )}

      {/* No Results After Filter */}
      {!loading && districts.length > 0 && filteredDistricts.length === 0 && (
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
      {!loading && filteredDistricts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 shadow rounded-lg">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  ชื่อสำนักงานเขต
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  ชื่อมูลนิธิ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  เลข กท.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                  คำอธิบาย
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
              {filteredDistricts.map((district, idx) => (
                <tr
                  key={district.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {district.name}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {district.foundationName}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {district.registrationNumber}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {district.description || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {district.isActive ? (
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
                        onClick={() => handleOpenEditModal(district)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteId(district.id)}
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
          <ModalTitle>{editingDistrict ? 'Edit District Office' : 'Add District Office'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* ชื่อสำนักงานเขต - Combobox */}
            <div>
              <label className="block text-sm font-medium mb-2">
                ชื่อสำนักงานเขต <span className="text-red-500">*</span>
              </label>
              <DistrictOfficeCombobox
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder="พิมพ์หรือเลือกจากรายการ (เช่น สำนักงานเขตจอมทอง)"
                className="w-full"
                disabled={saving}
              />
            </div>

            {/* ชื่อมูลนิธิ */}
            <Input
              label="ชื่อมูลนิธิ"
              type="text"
              value={formData.foundationName}
              onChange={(e) => setFormData({ ...formData, foundationName: e.target.value })}
              placeholder="เช่น จอมทอง"
              required
            />

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
            {saving ? 'Saving...' : editingDistrict ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete District Office"
        description="Are you sure you want to delete this district office? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />
    </div>
  );
}
