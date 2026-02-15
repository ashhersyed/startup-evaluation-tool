import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('ellipsis');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className="flex items-center justify-center gap-1">
      <Button
        variant="ghost"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="h-9 w-9 p-0 text-gray-400 hover:text-gray-100 disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pageNumbers.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-2 text-gray-600 text-sm">
            ...
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'ghost'}
            onClick={() => onPageChange(p)}
            className={`h-9 w-9 p-0 text-sm ${
              p === page
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'text-gray-400 hover:text-gray-100'
            }`}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="ghost"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="h-9 w-9 p-0 text-gray-400 hover:text-gray-100 disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
