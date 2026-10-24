import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationBar({ page, totalPages, onPageChange }: PaginationBarProps) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{`Page ${page} of ${totalPages}`}</span>
      <div className="flex gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
