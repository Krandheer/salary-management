import type {
  CountryUsdComparison,
  CurrencyCode,
  DepartmentUsdComparison,
  OrganisationComparison,
} from '@acme/contracts';
import { useOrganisationComparison } from '@/api/insights';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatSalary } from '@/shared/format';
import { EmptyState, ErrorState, LoadingState } from '@/shared/StateViews';

const NUMERIC_CELL = 'px-3 py-2 text-right tabular-nums';
const RATE_DECIMAL_PLACES = 6;
const REFERENCE_CURRENCY: CurrencyCode = 'USD';

function ApproximateNote() {
  return (
    <Alert>
      <AlertTitle>Converted figures are approximate</AlertTitle>
      <AlertDescription>
        Each salary is converted to US dollars at the fixed exchange rates below, so the averages
        are estimates.
      </AlertDescription>
    </Alert>
  );
}

function CountryUsdTable({ rows }: { rows: CountryUsdComparison[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Country</TableHead>
          <TableHead className="px-3 text-right">Headcount</TableHead>
          <TableHead className="px-3 text-right">Average (USD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.country}>
            <TableCell className="px-3 py-2">{row.countryName}</TableCell>
            <TableCell className={NUMERIC_CELL}>{row.headcount}</TableCell>
            <TableCell className={NUMERIC_CELL}>
              {formatSalary(row.averageSalaryUsd, REFERENCE_CURRENCY)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DepartmentUsdTable({ rows }: { rows: DepartmentUsdComparison[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Department</TableHead>
          <TableHead className="px-3 text-right">Headcount</TableHead>
          <TableHead className="px-3 text-right">Average (USD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.department}>
            <TableCell className="px-3 py-2">{row.department}</TableCell>
            <TableCell className={NUMERIC_CELL}>{row.headcount}</TableCell>
            <TableCell className={NUMERIC_CELL}>
              {formatSalary(row.averageSalaryUsd, REFERENCE_CURRENCY)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ExchangeRatesTable({ toUsd }: { toUsd: Record<CurrencyCode, number> }) {
  const currencies = (Object.keys(toUsd) as CurrencyCode[]).sort((a, b) => a.localeCompare(b));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Currency</TableHead>
          <TableHead className="px-3 text-right">Rate to USD (per 1 unit)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {currencies.map((currency) => (
          <TableRow key={currency}>
            <TableCell className="px-3 py-2">{currency}</TableCell>
            <TableCell className={NUMERIC_CELL}>
              {toUsd[currency].toFixed(RATE_DECIMAL_PLACES)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrganisationFigures({ data }: { data: OrganisationComparison }) {
  return (
    <div className="flex flex-col gap-8">
      <ApproximateNote />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">By country</h2>
        <CountryUsdTable rows={data.byCountry} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">By department</h2>
        <DepartmentUsdTable rows={data.byDepartment} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Exchange rates</h2>
        <p className="text-muted-foreground">
          Rates as of {data.ratesAsOf}. Source:{' '}
          <a className="underline" href={data.ratesSource} target="_blank" rel="noreferrer">
            {data.ratesSource}
          </a>
        </p>
        <ExchangeRatesTable toUsd={data.toUsd} />
      </section>
    </div>
  );
}

export function OrganisationComparisonPanel() {
  const { data, isError, error, isPending, refetch } = useOrganisationComparison();
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  if (isPending) return <LoadingState label="Loading organisation figures" />;
  if (data.byCountry.length === 0) return <EmptyState title="No employees yet" />;
  return <OrganisationFigures data={data} />;
}
