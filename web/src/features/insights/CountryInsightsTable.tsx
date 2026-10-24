import type { CountryCode, CountryInsight } from '@acme/contracts';
import { Button } from '@/components/ui/button';
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

interface CountryInsightsTableProps {
  rows: CountryInsight[];
  onSelectCountry: (code: CountryCode) => void;
}

export function CountryInsightsTable({ rows, onSelectCountry }: CountryInsightsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Country</TableHead>
          <TableHead className="px-3 text-right">Headcount</TableHead>
          <TableHead className="px-3 text-right">Min</TableHead>
          <TableHead className="px-3 text-right">Max</TableHead>
          <TableHead className="px-3 text-right">Mean</TableHead>
          <TableHead className="px-3 text-right">Median</TableHead>
          <TableHead className="px-3">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.country}>
            <TableCell className="px-3 py-2">{row.countryName}</TableCell>
            <TableCell className={NUMERIC_CELL}>{row.headcount}</TableCell>
            <TableCell className={NUMERIC_CELL}>{formatSalary(row.min, row.currency)}</TableCell>
            <TableCell className={NUMERIC_CELL}>{formatSalary(row.max, row.currency)}</TableCell>
            <TableCell className={NUMERIC_CELL}>{formatSalary(row.mean, row.currency)}</TableCell>
            <TableCell className={NUMERIC_CELL}>{formatSalary(row.median, row.currency)}</TableCell>
            <TableCell className="px-3 py-2 text-right">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`View job titles for ${row.countryName}`}
                onClick={() => onSelectCountry(row.country)}
              >
                View job titles
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
