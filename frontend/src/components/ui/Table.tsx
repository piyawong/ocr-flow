'use client';

import { forwardRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  striped?: boolean;
  hoverable?: boolean;
}

const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', striped = false, hoverable = true, children, ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-lg border border-border-color">
      <table
        ref={ref}
        className={`w-full border-collapse text-sm ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);

Table.displayName = 'Table';

// Table Header
interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}

const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <thead
      ref={ref}
      className={`bg-bg-secondary ${className}`}
      {...props}
    >
      {children}
    </thead>
  )
);

TableHeader.displayName = 'TableHeader';

// Table Body
interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className = '', children, ...props }, ref) => (
    <tbody ref={ref} className={className} {...props}>
      {children}
    </tbody>
  )
);

TableBody.displayName = 'TableBody';

// Table Row
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className = '', selected = false, children, ...props }, ref) => (
    <tr
      ref={ref}
      className={`
        border-b border-border-color
        transition-colors hover:bg-hover-bg
        ${selected ? 'bg-accent/5' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </tr>
  )
);

TableRow.displayName = 'TableRow';

// Table Head Cell
interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
  onSort?: () => void;
}

const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  (
    {
      className = '',
      sortable = false,
      sorted = false,
      onSort,
      children,
      ...props
    },
    ref
  ) => (
    <th
      ref={ref}
      className={`
        px-4 py-3 text-left font-semibold text-text-primary
        ${sortable ? 'cursor-pointer select-none hover:bg-hover-bg' : ''}
        ${className}
      `}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortable && (
          <span className="text-text-secondary">
            {sorted === 'asc' && '↑'}
            {sorted === 'desc' && '↓'}
            {!sorted && '↕'}
          </span>
        )}
      </div>
    </th>
  )
);

TableHead.displayName = 'TableHead';

// Table Cell
interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className = '', children, ...props }, ref) => (
    <td
      ref={ref}
      className={`px-4 py-3 text-text-primary ${className}`}
      {...props}
    >
      {children}
    </td>
  )
);

TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
