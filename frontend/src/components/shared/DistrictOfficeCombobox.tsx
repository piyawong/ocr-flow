'use client';

import React, { useEffect, useState, useRef } from 'react';

// Bangkok District Offices (50 districts)
export const BANGKOK_DISTRICTS = [
  'พระนคร',
  'ดุสิต',
  'หนองจอก',
  'บางรัก',
  'บางเขน',
  'บางกะปิ',
  'ปทุมวัน',
  'ป้อมปราบศัตรูพ่าย',
  'พระโขนง',
  'มีนบุรี',
  'ลาดกระบัง',
  'ยานนาวา',
  'สัมพันธวงศ์',
  'พญาไท',
  'ธนบุรี',
  'บางกอกใหญ่',
  'ห้วยขวาง',
  'คลองสาน',
  'ตลิ่งชัน',
  'บางกอกน้อย',
  'บางขุนเทียน',
  'ภาษีเจริญ',
  'หนองแขม',
  'ราษฎร์บูรณะ',
  'บางพลัด',
  'ดินแดง',
  'บึงกุ่ม',
  'สาทร',
  'บางซื่อ',
  'จตุจักร',
  'บางคอแหลม',
  'ประเวศ',
  'คลองเตย',
  'สวนหลวง',
  'จอมทอง',
  'ดอนเมือง',
  'ราชเทวี',
  'ลาดพร้าว',
  'วัฒนา',
  'บางแค',
  'หลักสี่',
  'สายไหม',
  'คันนายาว',
  'สะพานสูง',
  'วังทองหลาง',
  'คลองสามวา',
  'บางนา',
  'ทวีวัฒนา',
  'ทุ่งครุ',
  'บางบอน',
].sort(); // เรียงตามตัวอักษร

interface DistrictOfficeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  onClearError?: () => void;
  disabled?: boolean;
}

export function DistrictOfficeCombobox({
  value,
  onChange,
  placeholder = 'สำนักงานเขต',
  className = '',
  error = false,
  onClearError,
  disabled = false,
}: DistrictOfficeComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter options based on search query
  const filteredOptions = searchQuery.trim()
    ? BANGKOK_DISTRICTS.filter(option =>
        option.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : BANGKOK_DISTRICTS;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
    if (onClearError) {
      onClearError();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // Allow user to type custom value
    onChange(newValue);
    if (onClearError) {
      onClearError();
    }
  };

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const displayValue = value || searchQuery;

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`px-2.5 py-1 rounded-md bg-white/80 hover:bg-white focus:bg-white dark:bg-slate-700/60 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none transition-all duration-200 w-44 ${
            error
              ? 'border-rose-400 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20'
              : 'border-border-color/30 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <button
          type="button"
          onClick={toggleDropdown}
          disabled={disabled}
          className={`ml-1 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Dropdown List */}
      {isOpen && !disabled && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-64 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-border-color/30 rounded-lg shadow-lg"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={option}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                  index === highlightedIndex
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100'
                    : value === option
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    : 'text-text-primary hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {option}
                {value === option && (
                  <svg className="inline-block ml-2 w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-text-secondary">
              ไม่พบข้อมูล &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DistrictOfficeCombobox;
