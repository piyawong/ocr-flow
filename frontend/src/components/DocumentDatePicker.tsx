'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';

interface DocumentDatePickerProps {
  value: string; // YYYY-MM-DD format (ค.ศ.)
  onChange: (value: string | null) => void;
  onConfirm?: () => void;
  documentNumber: number;
  templateName: string;
  className?: string;
  triggerClassName?: string;
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

// Helper: แปลง ค.ศ. -> พ.ศ.
const yearCEtoBE = (ce: number): number => ce + 543;

// Helper: แปลง พ.ศ. -> ค.ศ.
const yearBEtoCE = (be: number): number => be - 543;

// Format date to Thai format
const formatThaiDate = (day: string, month: string, yearBE: string): string => {
  if (!day || !month || !yearBE) return '';
  const monthName = THAI_MONTHS[parseInt(month, 10) - 1];
  return `${day} ${monthName} ${yearBE}`;
};

export function DocumentDatePicker({
  value,
  onChange,
  onConfirm,
  documentNumber,
  templateName,
  className = '',
  triggerClassName = '',
}: DocumentDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [yearBE, setYearBE] = useState<string>('');

  const dayInputRef = useRef<HTMLInputElement>(null);
  const monthInputRef = useRef<HTMLInputElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);

  // Parse value when opening or value changes
  useEffect(() => {
    if (value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [yearCE, monthStr, dayStr] = value.split('-');
      setDay(dayStr);
      setMonth(monthStr);
      setYearBE(String(yearCEtoBE(parseInt(yearCE, 10))));
    } else if (!open) {
      setDay('');
      setMonth('');
      setYearBE('');
    }
  }, [value, open]);

  // Auto-focus day input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => dayInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Build YYYY-MM-DD (ค.ศ.)
  const buildDateString = (d: string, m: string, y: string): string => {
    if (!d || !m || !y) return '';
    const yearCE = yearBEtoCE(parseInt(y, 10));
    return `${yearCE.toString().padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  // Validate and constrain input
  const constrainDay = (val: string, m: string, y: string): string => {
    if (!val) return '';
    const num = parseInt(val, 10);
    if (isNaN(num)) return '';

    // Get max days in month
    let maxDays = 31;
    if (m && y) {
      const yearCE = yearBEtoCE(parseInt(y, 10));
      const monthNum = parseInt(m, 10);
      maxDays = new Date(yearCE, monthNum, 0).getDate();
    }

    return String(Math.max(1, Math.min(num, maxDays))).padStart(2, '0');
  };

  const constrainMonth = (val: string): string => {
    if (!val) return '';
    const num = parseInt(val, 10);
    if (isNaN(num)) return '';
    return String(Math.max(1, Math.min(num, 12))).padStart(2, '0');
  };

  const constrainYear = (val: string): string => {
    if (!val) return '';
    const num = parseInt(val, 10);
    if (isNaN(num)) return '';
    return String(Math.max(2400, Math.min(num, 2700)));
  };

  // Handle day input
  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // Only digits

    if (val.length <= 2) {
      setDay(val);

      // Auto-tab when 2 digits entered
      if (val.length === 2) {
        const constrained = constrainDay(val, month, yearBE);
        setDay(constrained);
        monthInputRef.current?.focus();
      }
    }
  };

  // Handle month input
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');

    if (val.length <= 2) {
      setMonth(val);

      // Auto-tab when 2 digits entered
      if (val.length === 2) {
        const constrained = constrainMonth(val);
        setMonth(constrained);
        yearInputRef.current?.focus();
      }
    }
  };

  // Handle year input
  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');

    if (val.length <= 4) {
      setYearBE(val);
    }
  };

  // Handle backspace for auto-tab back
  const handleDayKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && day === '') {
      // Already empty, do nothing
    }
  };

  const handleMonthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && month === '') {
      dayInputRef.current?.focus();
    } else if (e.key === 'Enter') {
      yearInputRef.current?.focus();
    }
  };

  const handleYearKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && yearBE === '') {
      monthInputRef.current?.focus();
    } else if (e.key === 'Enter' && yearBE.length === 4) {
      handleConfirm();
    }
  };

  // Confirm
  const handleConfirm = () => {
    // Constrain values before confirming
    const finalDay = constrainDay(day, month, yearBE);
    const finalMonth = constrainMonth(month);
    const finalYear = constrainYear(yearBE);

    const dateStr = buildDateString(finalDay, finalMonth, finalYear);
    onChange(dateStr || null);
    onConfirm?.();
    setOpen(false);
  };

  // Cancel
  const handleCancel = () => {
    if (value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [yearCE, monthStr, dayStr] = value.split('-');
      setDay(dayStr);
      setMonth(monthStr);
      setYearBE(String(yearCEtoBE(parseInt(yearCE, 10))));
    } else {
      setDay('');
      setMonth('');
      setYearBE('');
    }
    setOpen(false);
  };

  // Display value
  const displayValue = day && month && yearBE ? formatThaiDate(day, month, yearBE) : null;
  const isComplete = day && month && yearBE && yearBE.length === 4;

  return (
    <div className={cn('inline-block', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors',
              'bg-bg-secondary dark:bg-gray-700 hover:bg-bg-tertiary dark:hover:bg-gray-600',
              'text-text-primary dark:text-white border border-border-color dark:border-gray-600',
              triggerClassName
            )}
            title="กรอกวันที่เอกสาร"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {displayValue ? (
              <span className="font-medium">{displayValue}</span>
            ) : (
              <span className="text-text-secondary dark:text-gray-400">ไม่มีวันที่</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0 bg-card-bg dark:bg-gray-800 border-border-color dark:border-gray-700 shadow-lg"
          align="start"
          sideOffset={5}
        >
          <div className="p-4">
            {/* Header */}
            <div className="mb-4 pb-3 border-b border-border-color dark:border-gray-700">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-text-primary dark:text-white mb-1">
                    กรอกวันที่เอกสาร
                  </h4>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-text-secondary dark:text-gray-400 truncate">
                      เอกสาร: <span className="font-medium">{templateName}</span>
                    </p>
                    <p className="text-xs text-text-secondary dark:text-gray-400">
                      Document #{documentNumber}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-shrink-0 p-1 rounded-md hover:bg-bg-secondary dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Auto-Tab Input Fields */}
            <div className="space-y-3 mb-4">
              <label className="block text-sm font-medium text-text-primary dark:text-gray-300">
                วันที่ของเอกสาร <span className="text-text-muted dark:text-gray-500 text-xs font-normal">(ไม่บังคับ)</span>
              </label>

              {/* Input Fields */}
              <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-2">
                {/* Day */}
                <div>
                  <label className="block text-xs text-text-secondary dark:text-gray-400 mb-1.5">วัน</label>
                  <input
                    ref={dayInputRef}
                    type="text"
                    inputMode="numeric"
                    value={day}
                    onChange={handleDayChange}
                    onKeyDown={handleDayKeyDown}
                    placeholder="DD"
                    maxLength={2}
                    className="w-full px-3 py-2 text-sm text-center border border-border-color dark:border-gray-600 rounded-md bg-card-bg dark:bg-gray-700 text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all font-medium"
                  />
                </div>

                {/* Month */}
                <div>
                  <label className="block text-xs text-text-secondary dark:text-gray-400 mb-1.5">เดือน</label>
                  <input
                    ref={monthInputRef}
                    type="text"
                    inputMode="numeric"
                    value={month}
                    onChange={handleMonthChange}
                    onKeyDown={handleMonthKeyDown}
                    placeholder="MM"
                    maxLength={2}
                    className="w-full px-3 py-2 text-sm text-center border border-border-color dark:border-gray-600 rounded-md bg-card-bg dark:bg-gray-700 text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all font-medium"
                  />
                </div>

                {/* Year (พ.ศ.) */}
                <div>
                  <label className="block text-xs text-text-secondary dark:text-gray-400 mb-1.5">ปี (พ.ศ.)</label>
                  <input
                    ref={yearInputRef}
                    type="text"
                    inputMode="numeric"
                    value={yearBE}
                    onChange={handleYearChange}
                    onKeyDown={handleYearKeyDown}
                    placeholder="YYYY"
                    maxLength={4}
                    className="w-full px-3 py-2 text-sm text-center border border-border-color dark:border-gray-600 rounded-md bg-card-bg dark:bg-gray-700 text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all font-medium"
                  />
                </div>
              </div>

              {/* Live Preview */}
              {isComplete && (
                <div className="mt-3 p-2.5 bg-accent/5 dark:bg-accent/10 rounded-lg border border-accent/20 animate-in fade-in duration-200">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-text-primary dark:text-white font-semibold">
                      {formatThaiDate(day, month, yearBE)}
                    </p>
                  </div>
                  <p className="text-xs text-text-secondary dark:text-gray-400 text-center mt-1">
                    ค.ศ.: {buildDateString(day, month, yearBE)}
                  </p>
                </div>
              )}

              {/* Helper text */}
              <div className="text-[10px] text-text-muted dark:text-gray-500 space-y-0.5">
                <p>💡 พิมพ์ตัวเลขเท่านั้น - จะ auto-tab ไปช่องถัดไปเอง</p>
                <p>📝 ตัวอย่าง: พิมพ์ "21" → "12" → "2568"</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-3 border-t border-border-color dark:border-gray-700">
              <button
                onClick={handleCancel}
                className="flex-1 px-3 py-2 text-sm rounded-md bg-bg-secondary dark:bg-gray-700 hover:bg-bg-tertiary dark:hover:bg-gray-600 text-text-primary dark:text-white transition-colors border border-border-color dark:border-gray-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirm}
                disabled={!isComplete}
                className="flex-1 px-3 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
