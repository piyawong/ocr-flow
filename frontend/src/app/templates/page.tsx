'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ContextRules {
  requirePreviousCategory?: string;
  blockPreviousCategory?: string;
}

interface Template {
  id: number;
  name: string;
  firstPagePatterns: string[][] | null;
  lastPagePatterns: string[][] | null;
  firstPageNegativePatterns: string[][] | null;
  lastPageNegativePatterns: string[][] | null;
  category: string | null;
  isSinglePage: boolean;
  isActive: boolean;
  sortOrder: number;
  contextRules: ContextRules | null;
  createdAt: string;
  updatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

// Helper to convert patterns to display string
const patternsToString = (patterns: string[][] | null): string => {
  if (!patterns || patterns.length === 0) return '';
  return patterns.map(variant => variant.join(', ')).join('\n');
};

// Helper to parse string back to patterns array
const stringToPatterns = (str: string): string[][] | null => {
  if (!str.trim()) return null;
  const lines = str.split('\n').filter(line => line.trim());
  return lines.map(line => line.split(',').map(p => p.trim()).filter(p => p));
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    firstPagePatterns: '',
    lastPagePatterns: '',
    firstPageNegativePatterns: '',
    lastPageNegativePatterns: '',
    isSinglePage: false,
    isActive: true,
    sortOrder: 0,
    requirePreviousCategory: '',
    blockPreviousCategory: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Expanded view
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/templates`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: '',
      firstPagePatterns: '',
      lastPagePatterns: '',
      firstPageNegativePatterns: '',
      lastPageNegativePatterns: '',
      isSinglePage: false,
      isActive: true,
      sortOrder: templates.length + 1,
      requirePreviousCategory: '',
      blockPreviousCategory: '',
    });
    setShowModal(true);
  };

  const openEditModal = (template: Template) => {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      category: template.category || '',
      firstPagePatterns: patternsToString(template.firstPagePatterns),
      lastPagePatterns: patternsToString(template.lastPagePatterns),
      firstPageNegativePatterns: patternsToString(template.firstPageNegativePatterns),
      lastPageNegativePatterns: patternsToString(template.lastPageNegativePatterns),
      isSinglePage: template.isSinglePage,
      isActive: template.isActive,
      sortOrder: template.sortOrder,
      requirePreviousCategory: template.contextRules?.requirePreviousCategory || '',
      blockPreviousCategory: template.contextRules?.blockPreviousCategory || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build contextRules only if at least one field is set
      const contextRules = (formData.requirePreviousCategory || formData.blockPreviousCategory)
        ? {
            ...(formData.requirePreviousCategory && { requirePreviousCategory: formData.requirePreviousCategory }),
            ...(formData.blockPreviousCategory && { blockPreviousCategory: formData.blockPreviousCategory }),
          }
        : null;

      const body = {
        name: formData.name,
        category: formData.category || null,
        firstPagePatterns: stringToPatterns(formData.firstPagePatterns),
        lastPagePatterns: stringToPatterns(formData.lastPagePatterns),
        firstPageNegativePatterns: stringToPatterns(formData.firstPageNegativePatterns),
        lastPageNegativePatterns: stringToPatterns(formData.lastPageNegativePatterns),
        isSinglePage: formData.isSinglePage,
        isActive: formData.isActive,
        sortOrder: formData.sortOrder,
        contextRules,
      };

      const url = editingId ? `${API_URL}/templates/${editingId}` : `${API_URL}/templates`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      setShowModal(false);
      fetchTemplates();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteId(null);
      fetchTemplates();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/templates/${id}/toggle`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to toggle');
      fetchTemplates();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, t) => {
    const cat = t.category || 'ไม่มีหมวดหมู่';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, Template[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Templates Management</h1>
            <p className="text-gray-400 mt-1">
              Manage PDF labeling templates ({templates.length} templates, {templates.filter(t => t.isActive).length} active)
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/stages/03-pdf-label')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              Back to Label
            </button>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold"
            >
              + Add Template
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Templates List by Category */}
        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {category}
              <span className="text-sm text-gray-500 font-normal">({categoryTemplates.length})</span>
            </h2>
            <div className="space-y-2">
              {categoryTemplates.map((t, idx) => (
                <div key={t.id} className={`bg-gray-800 rounded-lg overflow-hidden ${!t.isActive ? 'opacity-50' : ''}`}>
                  {/* Main Row */}
                  <div
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-750"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  >
                    <span className="text-gray-500 w-8 text-sm">#{t.sortOrder}</span>
                    <span className={`w-3 h-3 rounded-full ${t.isActive ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                    <span className="font-medium flex-1">{t.name}</span>
                    {t.isSinglePage && (
                      <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded">Single Page</span>
                    )}
                    {t.firstPagePatterns && t.firstPagePatterns.length > 0 && (
                      <span className="px-2 py-0.5 bg-green-900/50 text-green-300 text-xs rounded">
                        {t.firstPagePatterns.length} patterns
                      </span>
                    )}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleActive(t.id)}
                        className={`px-3 py-1 rounded text-sm ${
                          t.isActive
                            ? 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-800/50'
                            : 'bg-green-900/50 text-green-300 hover:bg-green-800/50'
                        }`}
                      >
                        {t.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => openEditModal(t)}
                        className="px-3 py-1 bg-blue-900/50 text-blue-300 hover:bg-blue-800/50 rounded text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(t.id)}
                        className="px-3 py-1 bg-red-900/50 text-red-300 hover:bg-red-800/50 rounded text-sm"
                      >
                        Delete
                      </button>
                    </div>
                    <span className="text-gray-500">{expandedId === t.id ? '▼' : '▶'}</span>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === t.id && (
                    <div className="px-4 py-4 bg-gray-850 border-t border-gray-700 space-y-4">
                      {/* First Page Patterns */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">First Page Patterns (AND within line, OR between lines)</h4>
                        {t.firstPagePatterns && t.firstPagePatterns.length > 0 ? (
                          <div className="space-y-1">
                            {t.firstPagePatterns.map((variant, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span className="text-gray-500">OR {i + 1}:</span>
                                <span className="text-green-300 font-mono bg-gray-700 px-2 py-1 rounded">
                                  {variant.join(' AND ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </div>

                      {/* Last Page Patterns */}
                      {!t.isSinglePage && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Last Page Patterns</h4>
                          {t.lastPagePatterns && t.lastPagePatterns.length > 0 ? (
                            <div className="space-y-1">
                              {t.lastPagePatterns.map((variant, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">OR {i + 1}:</span>
                                  <span className="text-blue-300 font-mono bg-gray-700 px-2 py-1 rounded">
                                    {variant.join(' AND ')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </div>
                      )}

                      {/* Negative Patterns */}
                      {(t.firstPageNegativePatterns?.length || t.lastPageNegativePatterns?.length) ? (
                        <div className="grid grid-cols-2 gap-4">
                          {t.firstPageNegativePatterns && t.firstPageNegativePatterns.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-red-400 mb-2">First Page Negative</h4>
                              <div className="space-y-1">
                                {t.firstPageNegativePatterns.map((variant, i) => (
                                  <div key={i} className="text-sm text-red-300 font-mono bg-red-900/20 px-2 py-1 rounded">
                                    {variant.join(' AND ')}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {t.lastPageNegativePatterns && t.lastPageNegativePatterns.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-red-400 mb-2">Last Page Negative</h4>
                              <div className="space-y-1">
                                {t.lastPageNegativePatterns.map((variant, i) => (
                                  <div key={i} className="text-sm text-red-300 font-mono bg-red-900/20 px-2 py-1 rounded">
                                    {variant.join(' AND ')}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* Context Rules */}
                      {t.contextRules && (t.contextRules.requirePreviousCategory || t.contextRules.blockPreviousCategory) && (
                        <div className="border-t border-gray-700 pt-4">
                          <h4 className="text-sm font-medium text-blue-400 mb-2">Context-Based Rules</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {t.contextRules.requirePreviousCategory && (
                              <div>
                                <span className="text-xs text-gray-500">Require Previous:</span>
                                <div className="text-sm text-blue-300 font-mono bg-blue-900/20 px-2 py-1 rounded mt-1">
                                  {t.contextRules.requirePreviousCategory}
                                </div>
                              </div>
                            )}
                            {t.contextRules.blockPreviousCategory && (
                              <div>
                                <span className="text-xs text-gray-500">Block Previous:</span>
                                <div className="text-sm text-blue-300 font-mono bg-blue-900/20 px-2 py-1 rounded mt-1">
                                  {t.contextRules.blockPreviousCategory}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="bg-gray-800 rounded-lg px-4 py-8 text-center text-gray-400">
            No templates found. Click &quot;Add Template&quot; to create one.
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold">
                  {editingId ? 'Edit Template' : 'Create Template'}
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="e.g., ตราสาร.pdf"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="e.g., เอกสารเปลี่ยนแปลงมูลนิธิ"
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-gray-300">Active (use in auto-labeling)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isSinglePage}
                      onChange={(e) => setFormData({ ...formData, isSinglePage: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-gray-300">Single Page Document</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-300">Sort Order:</label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* First Page Patterns */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    First Page Patterns
                    <span className="text-gray-500 font-normal ml-2">
                      (each line = OR variant, comma-separated = AND)
                    </span>
                  </label>
                  <textarea
                    value={formData.firstPagePatterns}
                    onChange={(e) => setFormData({ ...formData, firstPagePatterns: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                    rows={4}
                    placeholder="pattern1, pattern2&#10;alt_pattern1, alt_pattern2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Example: &quot;ข้อบังคับ, หมวดที่&quot; means text must contain BOTH &quot;ข้อบังคับ&quot; AND &quot;หมวดที่&quot;
                  </p>
                </div>

                {/* Last Page Patterns */}
                {!formData.isSinglePage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Last Page Patterns
                    </label>
                    <textarea
                      value={formData.lastPagePatterns}
                      onChange={(e) => setFormData({ ...formData, lastPagePatterns: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                      rows={3}
                      placeholder="end_pattern1, end_pattern2"
                    />
                  </div>
                )}

                {/* Negative Patterns */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-red-400 mb-1">
                      First Page Negative Patterns
                      <span className="text-gray-500 font-normal ml-2">(reject if found)</span>
                    </label>
                    <textarea
                      value={formData.firstPageNegativePatterns}
                      onChange={(e) => setFormData({ ...formData, firstPageNegativePatterns: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-red-900 rounded-lg focus:outline-none focus:border-red-500 font-mono text-sm"
                      rows={2}
                      placeholder="negative_pattern"
                    />
                  </div>
                  {!formData.isSinglePage && (
                    <div>
                      <label className="block text-sm font-medium text-red-400 mb-1">
                        Last Page Negative Patterns
                      </label>
                      <textarea
                        value={formData.lastPageNegativePatterns}
                        onChange={(e) => setFormData({ ...formData, lastPageNegativePatterns: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-red-900 rounded-lg focus:outline-none focus:border-red-500 font-mono text-sm"
                        rows={2}
                        placeholder="negative_pattern"
                      />
                    </div>
                  )}
                </div>

                {/* Context Rules (NEW) */}
                <div className="border-t border-gray-700 pt-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-blue-400 mb-1">Context-Based Rules (Advanced)</h3>
                    <p className="text-sm text-gray-400">
                      Use previous document&apos;s category to determine which template to apply (useful for similar-looking documents)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-300 mb-1">
                        Require Previous Category
                        <span className="text-gray-500 font-normal ml-2">(must have)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.requirePreviousCategory}
                        onChange={(e) => setFormData({ ...formData, requirePreviousCategory: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-blue-900 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                        placeholder="e.g., เอกสารจัดตั้งมูลนิธิ"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This template will only match if the previous document has this category
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-300 mb-1">
                        Block Previous Category
                        <span className="text-gray-500 font-normal ml-2">(must NOT have)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.blockPreviousCategory}
                        onChange={(e) => setFormData({ ...formData, blockPreviousCategory: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-blue-900 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                        placeholder="e.g., เอกสารจัดตั้งมูลนิธิ"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This template will only match if the previous document does NOT have this category
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.name}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-bold mb-4">Confirm Delete</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete this template? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
