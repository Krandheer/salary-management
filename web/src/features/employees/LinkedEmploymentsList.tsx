import { Link } from 'react-router';
import type { LinkedEmployment } from '@acme/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/shared/format';
import { StatusBadge } from '@/shared/StatusBadge';

/** The other employment records of the same person (found by email), newest hire first. */
export function LinkedEmploymentsList({ items }: { items: LinkedEmployment[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Employee ID</TableHead>
          <TableHead className="px-3">Hire date</TableHead>
          <TableHead className="px-3">Exit date</TableHead>
          <TableHead className="px-3">Status</TableHead>
          <TableHead className="px-3">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="px-3 py-2">{item.id}</TableCell>
            <TableCell className="px-3 py-2">{formatDate(item.hireDate)}</TableCell>
            <TableCell className="px-3 py-2">
              {item.exitDate ? formatDate(item.exitDate) : '—'}
            </TableCell>
            <TableCell className="px-3 py-2">
              <StatusBadge status={item.status} />
            </TableCell>
            <TableCell className="px-3 py-2">
              <Link
                to={`/employees/${item.id}`}
                aria-label={`Open employee ${item.id}`}
                className="text-primary hover:underline"
              >
                Open
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
