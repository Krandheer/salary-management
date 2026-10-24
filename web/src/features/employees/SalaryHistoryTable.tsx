import type { SalaryHistoryEntry } from '@acme/contracts';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatSalary } from '@/shared/format';

const NO_REASON = '—';

/** Every salary entry, as ordered by the server: the first one is the current salary. */
export function SalaryHistoryTable({ entries }: { entries: SalaryHistoryEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Effective date</TableHead>
          <TableHead className="px-3 text-right">Salary</TableHead>
          <TableHead className="px-3">Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, index) => (
          <TableRow key={entry.id}>
            <TableCell className="px-3 py-2">{formatDate(entry.effectiveDate)}</TableCell>
            <TableCell className="px-3 py-2 text-right tabular-nums">
              {index === 0 && (
                <Badge variant="outline" className="mr-2 bg-accent text-accent-foreground">
                  Current
                </Badge>
              )}
              {formatSalary(entry.amount, entry.currency)}
            </TableCell>
            <TableCell className="px-3 py-2 whitespace-normal break-words">
              {entry.reason ?? NO_REASON}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
