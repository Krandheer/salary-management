import type { CountryJobTitleInsights } from '@acme/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatSalary } from '@/shared/format';

const NUMERIC_CELL = 'px-3 py-2 text-right tabular-nums';

export function JobTitleInsightsTable({ data }: { data: CountryJobTitleInsights }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Job title</TableHead>
          <TableHead className="px-3 text-right">Headcount</TableHead>
          <TableHead className="px-3 text-right">Min</TableHead>
          <TableHead className="px-3 text-right">Max</TableHead>
          <TableHead className="px-3 text-right">Mean</TableHead>
          <TableHead className="px-3 text-right">Median</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.jobTitles.map((row) => (
          <TableRow key={row.jobTitle}>
            <TableCell className="px-3 py-2">{row.jobTitle}</TableCell>
            <TableCell className={NUMERIC_CELL}>{row.headcount}</TableCell>
            <TableCell className={NUMERIC_CELL}>{formatSalary(row.min, data.currency)}</TableCell>
            <TableCell className={NUMERIC_CELL}>{formatSalary(row.max, data.currency)}</TableCell>
            <TableCell className={NUMERIC_CELL}>{formatSalary(row.mean, data.currency)}</TableCell>
            <TableCell className={NUMERIC_CELL}>
              {formatSalary(row.median, data.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
