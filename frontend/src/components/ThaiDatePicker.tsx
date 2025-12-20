'use client';

import { useState, useEffect } from 'react';

interface ThaiDatePickerProps {
  value: string; // YYYY-MM-DD format (ค.ศ.)
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

// Helper: แปลง ค.ศ. -> พ.ศ.
const yearCEtoBE = (ce: number): number => ce + 543;

// Helper: แปลง พ.ศ. -> ค.ศ.
const yearBEtoCE = (be: number): number => be - 543;

export function ThaiDatePicker({
  value,
  onChange,
  className = '',
  placeholder = 'เลือกวันที่...',
  autoFocus = false,
  onKeyDown,
}: ThaiDatePickerProps) {
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [yearBE, setYearBE] = useState<string>(''); // พ.ศ.

  // Parse value (YYYY-MM-DD) to day, month, yearBE
  useEffect(() => {
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
  }, [value]);

  // Build YYYY-MM-DD (ค.ศ.) from day, month, yearBE
  const buildDateString = (d: string, m: string, y: string): string => {
    if (!d || !m || !y) return '';
    const yearCE = yearBEtoCE(parseInt(y, 10));
    return `${yearCE.toString().padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  // Update date
  const updateDate = (newDay: string, newMonth: string, newYearBE: string) => {
    setDay(newDay);
    setMonth(newMonth);
    setYearBE(newYearBE);

    const dateStr = buildDateString(newDay, newMonth, newYearBE);
    onChange(dateStr);
  };

  // Generate year options (พ.ศ. 2400 - 2700)
  const generateYearOptions = () => {
    const years: number[] = [];
    const currentYearBE = yearCEtoBE(new Date().getFullYear());

    // ย้อนหลัง 100 ปี และข้างหน้า 50 ปี
    for (let y = currentYearBE - 100; y <= currentYearBE + 50; y++) {
      years.push(y);
    }

    return years.reverse(); // ปีล่าสุดไว้บนสุด
  };

  const yearOptions = generateYearOptions();

  // Days in month
  const getDaysInMonth = (m: string, y: string): number => {
    if (!m || !y) return 31;
    const yearCE = yearBEtoCE(parseInt(y, 10));
    const monthNum = parseInt(m, 10);
    return new Date(yearCE, monthNum, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(month, yearBE);
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Format display value
  const displayValue = () => {
    if (!day || !month || !yearBE) return '';
    const monthName = THAI_MONTHS[parseInt(month, 10) - 1];
    return `${day} ${monthName} ${yearBE}`;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Display Input (Read-only) */}
      <div className="relative">
        <input
          type="text"
          value={displayValue()}
          readOnly
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
          onClick={(e) => {
            // Focus on first select
            const firstSelect = e.currentTarget.nextElementSibling?.querySelector('select');
            firstSelect?.focus();
          }}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      {/* Dropdowns */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {/* Day */}
        <select
          value={day}
          onChange={(e) => updateDate(e.target.value, month, yearBE)}
          className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          disabled={!month || !yearBE}
        >
          <option value="">วัน</option>
          {dayOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Month */}
        <select
          value={month}
          onChange={(e) => {
            const newMonth = e.target.value;
            // Check if selected day is valid for new month
            if (day && yearBE) {
              const maxDays = getDaysInMonth(newMonth, yearBE);
              const newDay = parseInt(day, 10) > maxDays ? String(maxDays) : day;
              updateDate(newDay, newMonth, yearBE);
            } else {
              updateDate(day, newMonth, yearBE);
            }
          }}
          className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        >
          <option value="">เดือน</option>
          {THAI_MONTHS.map((m, idx) => (
            <option key={idx} value={idx + 1}>
              {m}
            </option>
          ))}
        </select>

        {/* Year (พ.ศ.) */}
        <select
          value={yearBE}
          onChange={(e) => {
            const newYearBE = e.target.value;
            // Check if selected day is valid for new year (leap year check)
            if (day && month) {
              const maxDays = getDaysInMonth(month, newYearBE);
              const newDay = parseInt(day, 10) > maxDays ? String(maxDays) : day;
              updateDate(newDay, month, newYearBE);
            } else {
              updateDate(day, month, newYearBE);
            }
          }}
          className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        >
          <option value="">ปี (พ.ศ.)</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Helper Text */}
      {displayValue() && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          ค.ศ.: {value}
        </p>
      )}
    </div>
  );
}
