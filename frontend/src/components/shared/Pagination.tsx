'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';

export interface PaginationProps extends HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
  showItemsPerPage?: boolean;
  showInfo?: boolean;
  size?: 'sm' | 'md';
}

const Pagination = forwardRef<HTMLDivElement, PaginationProps>(
  (
    {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage = 10,
      onPageChange,
      onItemsPerPageChange,
      itemsPerPageOptions = [10, 20, 50, 100],
      showItemsPerPage = true,
      showInfo = true,
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const isFirstPage = currentPage <= 1;
    const isLastPage = currentPage >= totalPages;

    // Calculate page range to display
    const getPageNumbers = () => {
      const pages: (number | 'ellipsis')[] = [];
      const maxVisible = 5;

      if (totalPages <= maxVisible) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Always show first page
        pages.push(1);

        if (currentPage > 3) {
          pages.push('ellipsis');
        }

        // Show pages around current
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          pages.push(i);
        }

        if (currentPage < totalPages - 2) {
          pages.push('ellipsis');
        }

        // Always show last page
        pages.push(totalPages);
      }

      return pages;
    };

    const buttonSize = size === 'sm' ? 'sm' : 'md';
    const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

    return (
      <div
        ref={ref}
        className={`flex flex-wrap items-center justify-between gap-4 ${className}`}
        {...props}
      >
        {/* Info Section */}
        {showInfo && totalItems !== undefined && (
          <div className={`${textSize} text-text-secondary`}>
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} -{' '}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
          </div>
        )}

        {/* Controls Section */}
        <div className="flex items-center gap-4">
          {/* Items per page */}
          {showItemsPerPage && onItemsPerPageChange && (
            <div className="flex items-center gap-2">
              <span className={`${textSize} text-text-secondary`}>Show:</span>
              <Select
                value={itemsPerPage.toString()}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onItemsPerPageChange(Number(e.target.value))
                }
                options={itemsPerPageOptions.map((n) => ({
                  value: n.toString(),
                  label: n.toString(),
                }))}
                fullWidth={false}
                className="w-20"
              />
            </div>
          )}

          {/* Page buttons */}
          <div className="flex items-center gap-1">
            {/* Previous button */}
            <Button
              variant="outline"
              size={buttonSize}
              onClick={() => onPageChange(currentPage - 1)}
              disabled={isFirstPage}
              aria-label="Previous page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </Button>

            {/* Page numbers */}
            {getPageNumbers().map((page, index) => (
              page === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-2 text-text-secondary">
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? 'primary' : 'ghost'}
                  size={buttonSize}
                  onClick={() => onPageChange(page)}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </Button>
              )
            ))}

            {/* Next button */}
            <Button
              variant="outline"
              size={buttonSize}
              onClick={() => onPageChange(currentPage + 1)}
              disabled={isLastPage}
              aria-label="Next page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

Pagination.displayName = 'Pagination';

export { Pagination };
