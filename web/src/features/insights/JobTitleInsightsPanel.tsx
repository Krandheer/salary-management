import type { CountryCode, CountryReference } from '@acme/contracts';
import { useJobTitleInsights } from '@/api/insights';
import { useReference } from '@/api/reference';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState, ErrorState, LoadingState } from '@/shared/StateViews';
import { JobTitleInsightsTable } from './JobTitleInsightsTable';

interface JobTitleInsightsPanelProps {
  selectedCountry: CountryCode | undefined;
  onSelectCountry: (code: CountryCode) => void;
}

function CountrySelect({
  countries,
  value,
  onChange,
}: {
  countries: CountryReference[];
  value: CountryCode;
  onChange: (code: CountryCode) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="insights-country">Country</Label>
      <Select value={value} onValueChange={(code) => onChange(code as CountryCode)}>
        <SelectTrigger id="insights-country" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {countries.map(({ code, name }) => (
            <SelectItem key={code} value={code}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function JobTitleFigures({ country }: { country: CountryCode }) {
  const { data, isError, error, isPending, refetch } = useJobTitleInsights(country);
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  if (isPending) return <LoadingState label="Loading job title insights" />;
  if (data.jobTitles.length === 0) return <EmptyState title="No employees in this country" />;
  return <JobTitleInsightsTable data={data} />;
}

function byCountryName(a: CountryReference, b: CountryReference): number {
  return a.name.localeCompare(b.name);
}

export function JobTitleInsightsPanel({
  selectedCountry,
  onSelectCountry,
}: JobTitleInsightsPanelProps) {
  const reference = useReference();
  if (reference.isError) {
    return (
      <ErrorState message={reference.error.message} onRetry={() => void reference.refetch()} />
    );
  }
  if (reference.isPending) return <LoadingState label="Loading countries" />;

  const countries = [...reference.data.countries].sort(byCountryName);
  const country = selectedCountry ?? countries[0]!.code;
  return (
    <div className="flex flex-col gap-4">
      <CountrySelect countries={countries} value={country} onChange={onSelectCountry} />
      <JobTitleFigures country={country} />
    </div>
  );
}
