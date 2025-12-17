'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '../../components/Navbar'

type PageInfo = {
  pageNumber: number
  template: string | null
  category: string | null
  status: string
  reason?: string
}

type ConfigData = {
  folder_id: number
  total_pages: number
  matched_pages: number
  unmatched_pages: number
  status: string
  pages: { [key: string]: PageInfo }
}

type TemplateInfo = {
  name: string
  category: string
  shortcut?: string
  example_file?: string | null
}

export default function ManualReviewPage() {
  const params = useParams()
  const router = useRouter()
  const [folderId, setFolderId] = useState<string>('')

  const [config, setConfig] = useState<ConfigData | null>(null)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [imageScale, setImageScale] = useState(1)
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [fitMode, setFitMode] = useState<'width' | 'height' | 'page' | 'actual'>('width')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showShortcutHelper, setShowShortcutHelper] = useState(false)

  // Range selection mode (always on)
  const [rangeStart, setRangeStart] = useState<number | null>(null)
  const [rangeEnd, setRangeEnd] = useState<number | null>(null)

  // Template selection modal
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateSearchTerm, setTemplateSearchTerm] = useState('')

  // Extract folderId from params safely
  useEffect(() => {
    if (params?.id) {
      setFolderId(params.id as string)
    }
  }, [params])

  useEffect(() => {
    if (folderId && folderId !== '') {
      fetchData()
    }
  }, [folderId])

  // Redirect to folder list if no folderId after params are loaded
  useEffect(() => {
    if (params && !params.id) {
      router.push('/manual-review')
    }
  }, [params, router])

  // Auto-scroll sidebar to current page
  useEffect(() => {
    const thumbnailElement = document.getElementById(`page-thumb-${currentPage}`)
    if (thumbnailElement) {
      thumbnailElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentPage])

  // Reset pan when changing pages
  useEffect(() => {
    setImagePan({ x: 0, y: 0 })
  }, [currentPage])

  // Handle mouse wheel zoom - Optimized for smooth zooming with fine control
  useEffect(() => {
    const imageContainer = document.getElementById('image-container')
    if (!imageContainer) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      // Reduced delta from 0.1 to 0.03 for finer zoom control (3% per scroll)
      const delta = e.deltaY > 0 ? -0.03 : 0.03
      const newScale = Math.max(0.25, Math.min(3, imageScale + delta))

      requestAnimationFrame(() => {
        setImageScale(newScale)
        setFitMode('actual')
      })
    }

    imageContainer.addEventListener('wheel', handleWheel, { passive: false })
    return () => imageContainer.removeEventListener('wheel', handleWheel)
  }, [imageScale])

  // Pan handlers - Optimized for smooth dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - imagePan.x, y: e.clientY - imagePan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      requestAnimationFrame(() => {
        setImagePan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        })
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch handlers for mobile/tablet support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart({ x: touch.clientX - imagePan.x, y: touch.clientY - imagePan.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0]
      requestAnimationFrame(() => {
        setImagePan({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y
        })
      })
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    if (fitMode === 'width') {
      setFitMode('actual')
      setImageScale(1)
    } else {
      setFitMode('width')
      applyFitMode('width')
    }
  }

  const applyFitMode = (mode: 'width' | 'height' | 'page' | 'actual') => {
    setFitMode(mode)
    setImagePan({ x: 0, y: 0 })

    if (mode === 'actual') {
      setImageScale(1)
    } else if (mode === 'width') {
      setImageScale(0.95)
    } else if (mode === 'height') {
      setImageScale(0.85)
    } else if (mode === 'page') {
      setImageScale(0.7)
    }
  }

  const zoomPreset = (scale: number) => {
    setImageScale(Math.max(0.25, Math.min(3, scale)))
    setFitMode('actual')
    setImagePan({ x: 0, y: 0 })
  }

  // Initialize fit to width on mount
  useEffect(() => {
    applyFitMode('width')
  }, [folderId])


  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!config || !templates) return

      // Close modal on Escape
      if (e.key === 'Escape' && showTemplateModal) {
        setShowTemplateModal(false)
        return
      }

      // Don't handle other shortcuts when modal is open
      if (showTemplateModal) return

      // Number keys 1-9 for template selection (quick mode when no modal)
      if (e.key >= '1' && e.key <= '9' && selectedPages.size > 0) {
        const index = parseInt(e.key) - 1
        if (templates.length > 0 && index < templates.length) {
          handleLabelPages(templates[index].name, templates[index].category)
        }
      }
      // Arrow keys for navigation
      else if (e.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(currentPage - 1)
      }
      else if (e.key === 'ArrowRight' && currentPage < config.total_pages) {
        setCurrentPage(currentPage + 1)
      }
      // Space to toggle selection
      else if (e.key === ' ') {
        e.preventDefault()
        togglePageSelection(currentPage)
      }
      // Press 'c' to clear selection
      else if (e.key === 'c' || e.key === 'C') {
        clearSelection()
      }
      // Press 't' to open template modal
      else if (e.key === 't' || e.key === 'T') {
        if (selectedPages.size > 0) {
          setShowTemplateModal(true)
        }
      }
      // Press 'h' to toggle shortcut helper
      else if (e.key === 'h' || e.key === 'H') {
        setShowShortcutHelper(!showShortcutHelper)
      }
      // Press 's' to save
      else if (e.key === 's' && e.metaKey) {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPage, config, templates, selectedPages, showShortcutHelper, showTemplateModal])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [configRes, templatesRes] = await Promise.all([
        fetch(`/api/manual-review/${folderId}/config`),
        fetch('/api/manual-review/templates')
      ])

      const configData = await configRes.json()
      const templatesData = await templatesRes.json()

      setConfig(configData)
      setTemplates(templatesData.templates)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePageSelection = (pageNum: number) => {
    handleRangeSelection(pageNum)
  }

  const handleRangeSelection = (pageNum: number) => {
    if (rangeStart === null) {
      // First click - set start
      setRangeStart(pageNum)
      setRangeEnd(null)
      setSelectedPages(new Set([pageNum]))
    } else if (rangeEnd === null) {
      // Second click - set end and auto-select range
      const start = Math.min(rangeStart, pageNum)
      const end = Math.max(rangeStart, pageNum)
      setRangeEnd(pageNum)

      const range = new Set<number>()
      for (let i = start; i <= end; i++) {
        range.add(i)
      }
      setSelectedPages(range)

      // Auto-open template selection modal
      setShowTemplateModal(true)
    } else {
      // Third click - reset and start new range
      setRangeStart(pageNum)
      setRangeEnd(null)
      setSelectedPages(new Set([pageNum]))
      setShowTemplateModal(false)
    }
  }

  const clearSelection = () => {
    setSelectedPages(new Set())
    setRangeStart(null)
    setRangeEnd(null)
  }

  const selectCurrentToEnd = () => {
    if (!config) return
    const range = new Set<number>()
    for (let i = currentPage; i <= config.total_pages; i++) {
      range.add(i)
    }
    setSelectedPages(range)
    setRangeStart(currentPage)
    setRangeEnd(config.total_pages)
  }

  const selectAllPages = () => {
    if (!config) return
    const range = new Set<number>()
    for (let i = 1; i <= config.total_pages; i++) {
      range.add(i)
    }
    setSelectedPages(range)
    setRangeStart(1)
    setRangeEnd(config.total_pages)
  }

  const handleLabelPages = (templateName: string, category: string | null) => {
    if (!config || !config.pages) return

    const pagesToLabel = selectedPages.size > 0 ? Array.from(selectedPages) : [currentPage]

    const updatedPages = { ...config.pages }
    pagesToLabel.forEach(pageNum => {
      updatedPages[pageNum.toString()] = {
        pageNumber: pageNum,
        template: templateName,
        category: category,
        status: 'matched',
        reason: 'manual-review'
      }
    })

    setConfig({
      ...config,
      pages: updatedPages
    })

    // Clear selection and close modal after labeling
    setSelectedPages(new Set())
    setRangeStart(null)
    setRangeEnd(null)
    setShowTemplateModal(false)
    setTemplateSearchTerm('')
  }

  const handleClearLabel = () => {
    if (!config || !config.pages) return

    const pagesToClear = selectedPages.size > 0 ? Array.from(selectedPages) : [currentPage]

    const updatedPages = { ...config.pages }
    pagesToClear.forEach(pageNum => {
      updatedPages[pageNum.toString()] = {
        pageNumber: pageNum,
        template: null,
        category: null,
        status: 'unmatched',
      }
    })

    setConfig({
      ...config,
      pages: updatedPages
    })

    setSelectedPages(new Set())
  }

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    try {
      const response = await fetch(`/api/manual-review/${folderId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        alert('✅ Saved successfully!')
      } else {
        alert('❌ Failed to save')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      alert('❌ Error saving changes')
    } finally {
      setSaving(false)
    }
  }

  // Don't render until we have folderId
  if (!folderId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="p-6">
          <div className="text-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="p-6">
          <div className="text-center py-12">
            <div className="text-gray-500">Loading folder {folderId}...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="p-6">
          <div className="text-center py-12">
            <div className="text-red-500">Failed to load folder {folderId}</div>
          </div>
        </div>
      </div>
    )
  }

  const currentPageInfo = config.pages?.[currentPage.toString()] || null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Manual Review - Folder {folderId}
            </h1>
            <span className={`px-3 py-1 text-sm rounded ${
              config.status === 'matched'
                ? 'bg-green-100 text-green-800'
                : 'bg-orange-100 text-orange-800'
            }`}>
              {config.matched_pages}/{config.total_pages} pages matched
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowShortcutHelper(!showShortcutHelper)}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              {showShortcutHelper ? 'Hide' : 'Show'} Shortcuts (H)
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes (⌘S)'}
            </button>
          </div>
        </div>
      </div>

      {/* Shortcut Helper Overlay */}
      {showShortcutHelper && (
        <div className="fixed top-20 right-6 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-xl max-w-sm">
          <h3 className="font-bold mb-3">⌨️ Keyboard Shortcuts</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Space</span><span>Select Start/End page</span></div>
            <div className="flex justify-between"><span>← →</span><span>Navigate pages</span></div>
            <div className="flex justify-between"><span>T</span><span>Open template modal</span></div>
            <div className="flex justify-between"><span>1-9</span><span>Quick label (no modal)</span></div>
            <div className="flex justify-between"><span>C</span><span>Clear selection</span></div>
            <div className="flex justify-between"><span>Esc</span><span>Close modal</span></div>
            <div className="flex justify-between"><span>H</span><span>Toggle this helper</span></div>
            <div className="flex justify-between"><span>⌘S</span><span>Save changes</span></div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Select Template</h2>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Selection Info */}
              {rangeStart && rangeEnd && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                    📍 Start: {rangeStart}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                    🏁 End: {rangeEnd}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                    {selectedPages.size} pages
                  </span>
                </div>
              )}

              {/* Search Input */}
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="🔍 Search templates... (ค้นหาชื่อเอกสาร)"
                  value={templateSearchTerm}
                  onChange={(e) => setTemplateSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-2">
                {templates && templates.length > 0 && templates
                  .filter(template =>
                    !templateSearchTerm ||
                    template.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                    template.category?.toLowerCase().includes(templateSearchTerm.toLowerCase())
                  )
                  .map((template, index) => (
                    <div
                      key={template.name}
                      className="w-full p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleLabelPages(template.name, template.category)}
                          className="flex-1 text-left"
                        >
                          <div className="font-medium text-gray-900 group-hover:text-blue-700">
                            {template.name.replace('.pdf', '')}
                          </div>
                          {template.category && (
                            <div className="text-xs text-gray-500 mt-1">
                              📁 {template.category}
                            </div>
                          )}
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {template.example_file && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const previewUrl = `/api/templates/${encodeURIComponent(template.name)}/image?t=${Date.now()}`
                                window.open(previewUrl, '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no')
                              }}
                              className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium transition-colors"
                              title="Preview template example (opens in new window)"
                            >
                              👁️ Preview
                            </button>
                          )}
                          {index < 9 && (
                            <div className="px-2 py-1 bg-gray-200 group-hover:bg-blue-200 text-gray-700 group-hover:text-blue-900 rounded text-xs font-bold">
                              {index + 1}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* No Results */}
              {templateSearchTerm && templates.filter(t =>
                t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                t.category?.toLowerCase().includes(templateSearchTerm.toLowerCase())
              ).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-2">🔍</div>
                  <div>ไม่พบเอกสารที่ตรงกับ "{templateSearchTerm}"</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>
                  💡 Tip: Use arrow keys to navigate, Enter to select
                </div>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
                >
                  Cancel (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-140px)]">
        {/* Thumbnail Sidebar - LEFT */}
        <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Pages</h3>
            <div className="space-y-2">
              {config && config.total_pages > 0 && Array.from({ length: config.total_pages }, (_, i) => i + 1).map(pageNum => {
                const pageInfo = config.pages[pageNum.toString()]
                const isSelected = selectedPages.has(pageNum)
                const isCurrent = pageNum === currentPage
                const isRangeStart = pageNum === rangeStart
                const isRangeEnd = pageNum === rangeEnd
                const isInRange = rangeStart && rangeEnd &&
                                 pageNum > Math.min(rangeStart, rangeEnd) &&
                                 pageNum < Math.max(rangeStart, rangeEnd)

                return (
                  <button
                    key={pageNum}
                    id={`page-thumb-${pageNum}`}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-full text-left p-2 rounded text-sm transition-colors relative ${
                      isCurrent
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : isRangeStart
                        ? 'bg-green-50 border-2 border-green-500'
                        : isRangeEnd
                        ? 'bg-red-50 border-2 border-red-500'
                        : isInRange
                        ? 'bg-blue-50 border-2 border-blue-300'
                        : isSelected
                        ? 'bg-purple-50 border-2 border-purple-500'
                        : pageInfo?.status === 'matched'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-200'
                    } hover:bg-gray-100`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Page {pageNum}
                        {isRangeStart && <span className="ml-1 text-green-600 text-xs">📍Start</span>}
                        {isRangeEnd && <span className="ml-1 text-red-600 text-xs">🏁End</span>}
                      </span>
                      {pageInfo?.status === 'matched' && <span className="text-green-600">✓</span>}
                    </div>
                    {pageInfo?.template && (
                      <div className="text-xs text-gray-600 mt-1 truncate">
                        {pageInfo.template.replace('.pdf', '')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Image Preview Panel */}
          <div className="flex-1 bg-gray-100 p-6 overflow-auto">
            <div className="bg-white rounded-lg shadow-lg p-4">
              {/* Image Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm font-medium px-3">
                    Page {currentPage} / {config.total_pages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(config.total_pages, currentPage + 1))}
                    disabled={currentPage === config.total_pages}
                    className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium"
                  >
                    Next →
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Fit Mode Buttons */}
                  <button
                    onClick={() => applyFitMode('width')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium ${
                      fitMode === 'width'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="Fit to Width"
                  >
                    ↔ Width
                  </button>
                  <button
                    onClick={() => applyFitMode('height')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium ${
                      fitMode === 'height'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="Fit to Height"
                  >
                    ↕ Height
                  </button>
                  <button
                    onClick={() => applyFitMode('page')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium ${
                      fitMode === 'page'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="Fit Page"
                  >
                    📄 Page
                  </button>
                  <div className="w-px h-6 bg-gray-300"></div>

                  {/* Zoom Dropdown */}
                  <select
                    value={Math.round(imageScale * 100)}
                    onChange={(e) => zoomPreset(parseInt(e.target.value) / 100)}
                    className="px-3 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 cursor-pointer"
                  >
                    <option value="25">25%</option>
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                    <option value="125">125%</option>
                    <option value="150">150%</option>
                    <option value="200">200%</option>
                    <option value="300">300%</option>
                  </select>

                  <button
                    onClick={() => zoomPreset(imageScale - 0.25)}
                    disabled={imageScale <= 0.25}
                    className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-bold"
                  >
                    −
                  </button>
                  <button
                    onClick={() => zoomPreset(imageScale + 0.25)}
                    disabled={imageScale >= 3}
                    className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Zoom Instructions */}
              <div className="mb-2 text-xs text-gray-500 text-center">
                💡 Mouse wheel to zoom | Drag to pan | Double-click to toggle fit
              </div>

              {/* Image Display - Advanced Viewer */}
              <div
                id="image-container"
                className={`overflow-hidden h-[calc(100vh-330px)] flex items-center justify-center bg-gray-900 rounded-lg relative ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onDoubleClick={handleDoubleClick}
              >
                <img
                  src={`/api/manual-review/${folderId}/image/${currentPage}`}
                  alt={`Page ${currentPage}`}
                  style={{
                    transform: `scale(${imageScale}) translate(${imagePan.x / imageScale}px, ${imagePan.y / imageScale}px)`,
                    transformOrigin: 'center center',
                    willChange: isDragging ? 'transform' : 'auto'
                  }}
                  className="max-w-full max-h-full object-contain select-none"
                  draggable={false}
                />
              </div>
            </div>
          </div>

          {/* Control Panel - RIGHT */}
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="p-6">
              {/* Instructions */}
              <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                <div className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <span className="text-lg">📌</span>
                  How to Label Pages
                </div>
                <div className="text-xs text-blue-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-green-600">1️⃣</span>
                    <span>Click <span className="font-semibold">START</span> page (Green)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-red-600">2️⃣</span>
                    <span>Click <span className="font-semibold">END</span> page (Red)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">3️⃣</span>
                    <span>Select template from modal</span>
                  </div>
                </div>
              </div>

              {/* Current Page Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Page {currentPage} Label</h3>

                {currentPageInfo?.template ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Current Template:</div>
                    <div className="font-medium text-green-900">{currentPageInfo.template}</div>
                    {currentPageInfo.category && (
                      <div className="text-xs text-gray-500 mt-1">Category: {currentPageInfo.category}</div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm text-orange-800">⚠️ Not labeled yet</div>
                  </div>
                )}
              </div>

              {/* Selection Status */}
              {selectedPages.size > 0 && (
                <div className="mb-6">
                  {rangeStart && rangeEnd ? (
                    <div className="p-4 bg-gradient-to-r from-green-50 via-blue-50 to-red-50 border-2 border-blue-300 rounded-xl">
                      <div className="text-sm font-bold text-gray-900 mb-3">
                        📊 Selected: {selectedPages.size} page{selectedPages.size > 1 ? 's' : ''}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-3 py-1.5 bg-green-200 text-green-900 rounded-lg font-semibold text-xs">
                          📍 {rangeStart}
                        </span>
                        <span className="text-gray-400 text-xs">→</span>
                        <span className="px-3 py-1.5 bg-red-200 text-red-900 rounded-lg font-semibold text-xs">
                          🏁 {rangeEnd}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowTemplateModal(true)}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                      >
                        Choose Template (T)
                      </button>
                    </div>
                  ) : rangeStart && !rangeEnd ? (
                    <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                      <div className="text-sm font-bold text-green-900 mb-1">
                        ✅ Start Selected
                      </div>
                      <div className="text-2xl font-bold text-green-600 mb-2">
                        Page {rangeStart}
                      </div>
                      <div className="text-xs text-green-700">
                        👉 Now click the END page
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Quick Actions */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">⚡ Quick Select</h3>
                <div className="space-y-2">
                  <button
                    onClick={selectCurrentToEnd}
                    className="w-full py-2.5 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium flex items-center justify-between"
                  >
                    <span>Current → End</span>
                    <span className="text-xs">📄→📄</span>
                  </button>
                  <button
                    onClick={selectAllPages}
                    className="w-full py-2.5 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium flex items-center justify-between"
                  >
                    <span>Select All Pages</span>
                    <span className="text-xs">📚</span>
                  </button>
                  {selectedPages.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="w-full py-2.5 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                    >
                      ✕ Clear Selection (C)
                    </button>
                  )}
                </div>
              </div>

              {/* Template Selection Buttons */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">🏷️ Templates</h3>
                  {selectedPages.size > 0 && (
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      🔍 Search
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {templates && templates.length > 0 && templates.slice(0, 12).map((template, index) => (
                    <button
                      key={template.name}
                      onClick={() => handleLabelPages(template.name, template.category)}
                      disabled={selectedPages.size === 0}
                      className="w-full p-3 text-left bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {template.name.replace('.pdf', '')}
                          </div>
                          {template.category && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate">{template.category}</div>
                          )}
                        </div>
                        <div className="ml-2 px-2 py-1 bg-blue-200 text-blue-900 rounded text-xs font-bold flex-shrink-0">
                          {index + 1}
                        </div>
                      </div>
                    </button>
                  ))}
                  {templates.length > 12 && (
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="w-full p-3 text-center bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm text-gray-700 font-medium"
                    >
                      +{templates.length - 12} more templates... (Click to search)
                    </button>
                  )}
                </div>
              </div>

              {/* Clear Label */}
              {selectedPages.size > 0 && (
                <button
                  onClick={handleClearLabel}
                  className="w-full p-3 text-center bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <div className="font-medium text-sm text-red-900">
                    🗑️ Remove Labels
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
