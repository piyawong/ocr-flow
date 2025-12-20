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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          กรอกวันที่เอกสาร
        </h2>

        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            เอกสาร: <span className="font-medium text-gray-800 dark:text-gray-200">{templateName}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Document #{documentNumber}
          </p>

          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            วันที่ของเอกสาร <span className="text-gray-400 text-xs">(ไม่บังคับ)</span>
          </label>
          <ThaiDatePicker
            value={date}
            onChange={setDate}
            onKeyDown={handleKeyDown}
            placeholder="เลือกวันที่..."
            autoFocus
          />
          {date && (
            <button
              type="button"
              onClick={() => setDate('')}
              className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
            >
              ล้างวันที่
            </button>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleSkip}
            className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white transition-colors"
          >
            ข้าม (ไม่กรอก)
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
          >
            {date ? 'ยืนยัน' : 'ข้าม'}
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
          กด <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">Enter</kbd> เพื่อยืนยัน หรือ <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">Esc</kbd> เพื่อข้าม
        </p>
      </div>
    </div>
  );
}
