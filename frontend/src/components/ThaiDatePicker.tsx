'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';

interface ThaiDatePickerProps {
  value: string; // YYYY-MM-DD format (ค.ศ.)
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

// Helper: แปลง ค.ศ. -> พ.ศ.
const yearCEtoBE = (ce: number): number => ce + 543;

// Helper: แปลง พ.ศ. -> ค.ศ.
const yearBEtoCE = (be: number): number => be - 543;

// Format date to Thai format (DD MMMM YYYY พ.ศ.)
const formatThaiDate = (date: Date | null): string => {
  if (!date) return '';
  const day = date.getDate();
  const month = format(date, 'MMMM', { locale: th });
  const yearBE = yearCEtoBE(date.getFullYear());
  return `${day} ${month} ${yearBE}`;
};

export function ThaiDatePicker({
  value,
  onChange,
  className = '',
  placeholder = 'เลือกวันที่...',
  autoFocus = false,
  onKeyDown,
}: ThaiDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  // Parse value (YYYY-MM-DD) to Date
  useEffect(() => {
    if (value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(value + 'T00:00:00');
      setSelectedDate(date);
    } else {
      setSelectedDate(undefined);
    }
  }, [value]);

  // Handle date selection
  const handleSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      // Format to YYYY-MM-DD (ค.ศ.)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
      setOpen(false);
    }
  };

  // Quick select handlers
  const handleToday = () => {
    const today = new Date();
    handleSelect(today);
  };

  const handleYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    handleSelect(yesterday);
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    onChange('');
    setOpen(false);
  };

  // Keyboard handlers for trigger button
  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
    onKeyDown?.(e);
  };

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'w-full px-3 py-2 text-left border rounded-md transition-all',
              'bg-card-bg dark:bg-gray-700',
              'border-border-color dark:border-gray-600',
              'text-text-primary dark:text-white',
              'hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
              !selectedDate && 'text-text-secondary dark:text-gray-400'
            )}
            onKeyDown={handleTriggerKeyDown}
            autoFocus={autoFocus}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {selectedDate ? formatThaiDate(selectedDate) : placeholder}
              </span>
              <CalendarIcon className="h-4 w-4 text-text-secondary" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-card-bg dark:bg-gray-800 border-border-color"
          align="start"
        >
          <div className="p-3">
            {/* Quick Select Buttons */}
            <div className="flex gap-2 mb-3 pb-3 border-b border-border-color">
              <button
                type="button"
                onClick={handleToday}
                className="flex-1 px-2 py-1.5 text-xs rounded-md bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={handleYesterday}
                className="flex-1 px-2 py-1.5 text-xs rounded-md bg-bg-secondary dark:bg-gray-700 hover:bg-bg-tertiary dark:hover:bg-gray-600 text-text-primary dark:text-white transition-colors"
              >
                เมื่อวาน
              </button>
              {selectedDate && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 px-2 py-1.5 text-xs rounded-md bg-danger/10 hover:bg-danger/20 text-danger transition-colors"
                >
                  ล้าง
                </button>
              )}
            </div>

            {/* Calendar */}
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              initialFocus
              locale={th}
              className="rounded-md"
            />

            {/* Display selected date in Thai + CE format */}
            {selectedDate && (
              <div className="mt-3 pt-3 border-t border-border-color text-center">
                <p className="text-xs text-text-secondary dark:text-gray-400">
                  ค.ศ.: {format(selectedDate, 'yyyy-MM-dd')}
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
