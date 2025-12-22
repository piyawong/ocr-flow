'use client';

import { useState, useEffect } from 'react';
import { ThaiDatePicker } from './ThaiDatePicker';

interface DocumentDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string | null) => void;
  documentNumber: number;
  templateName: string;
  initialDate?: string | null;
}

export function DocumentDateModal({
  isOpen,
  onClose,
  onConfirm,
  documentNumber,
  templateName,
  initialDate,
}: DocumentDateModalProps) {
  const [date, setDate] = useState<string>(initialDate || '');

  useEffect(() => {
    setDate(initialDate || '');
  }, [initialDate, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(date || null);
    onClose();
  };

  const handleSkip = () => {
    onConfirm(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleSkip();
    }
  };

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleSkip();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-card-bg dark:bg-gray-800 rounded-xl p-5 w-full max-w-sm shadow-xl border border-border-color dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-text-primary dark:text-white mb-1">
            กรอกวันที่เอกสาร
          </h3>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-text-secondary dark:text-gray-400">
              เอกสาร: <span className="font-medium text-text-primary dark:text-gray-300">{templateName}</span>
            </p>
            <p className="text-xs text-text-secondary dark:text-gray-400">
              Document #{documentNumber}
            </p>
          </div>
        </div>

        {/* Date Picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-text-primary dark:text-gray-300">
            วันที่ของเอกสาร <span className="text-text-muted dark:text-gray-500 text-xs font-normal">(ไม่บังคับ)</span>
          </label>
          <ThaiDatePicker
            value={date}
            onChange={setDate}
            onKeyDown={handleKeyDown}
            placeholder="เลือกวันที่..."
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end pt-2 border-t border-border-color dark:border-gray-700">
          <button
            onClick={handleSkip}
            className="px-3 py-1.5 text-sm rounded-md bg-bg-secondary dark:bg-gray-700 hover:bg-bg-tertiary dark:hover:bg-gray-600 text-text-primary dark:text-white transition-colors"
          >
            ข้าม
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 text-sm rounded-md bg-accent hover:bg-accent-dark text-white transition-colors shadow-sm"
          >
            {date ? 'ยืนยัน' : 'ข้าม'}
          </button>
        </div>

        {/* Keyboard Hint */}
        <p className="text-[10px] text-text-muted dark:text-gray-500 mt-3 text-center">
          กด <kbd className="px-1 py-0.5 bg-bg-secondary dark:bg-gray-700 rounded text-[10px] border border-border-color dark:border-gray-600">Enter</kbd> เพื่อยืนยัน หรือ <kbd className="px-1 py-0.5 bg-bg-secondary dark:bg-gray-700 rounded text-[10px] border border-border-color dark:border-gray-600">Esc</kbd> เพื่อข้าม
        </p>
      </div>
    </div>
  );
}
