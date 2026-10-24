import type { CountryCode } from '@acme/contracts';
import { useState } from 'react';
import { useCountryInsights } from '@/api/insights';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, ErrorState, LoadingState } from '@/shared/StateViews';
import { CountryInsightsTable } from './CountryInsightsTable';
import { JobTitleInsightsPanel } from './JobTitleInsightsPanel';

const COUNTRY_TAB = 'country';
const JOB_TITLE_TAB = 'job-title';
const ORGANISATION_TAB = 'organisation';

function CountryInsightsPanel({
  onSelectCountry,
}: {
  onSelectCountry: (code: CountryCode) => void;
}) {
  const { data, isError, error, isPending, refetch } = useCountryInsights();
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  if (isPending) return <LoadingState label="Loading country insights" />;
  if (data.countries.length === 0) return <EmptyState title="No employees yet" />;
  return <CountryInsightsTable rows={data.countries} onSelectCountry={onSelectCountry} />;
}

function ComingSoon() {
  return <p className="text-muted-foreground">This view is coming soon.</p>;
}

export function InsightsPage() {
  const [tab, setTab] = useState(COUNTRY_TAB);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | undefined>();

  function showJobTitlesOf(code: CountryCode) {
    setSelectedCountry(code);
    setTab(JOB_TITLE_TAB);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value={COUNTRY_TAB}>By country</TabsTrigger>
          <TabsTrigger value={JOB_TITLE_TAB}>By job title</TabsTrigger>
          <TabsTrigger value={ORGANISATION_TAB}>Organisation (USD)</TabsTrigger>
        </TabsList>
        <TabsContent value={COUNTRY_TAB}>
          <CountryInsightsPanel onSelectCountry={showJobTitlesOf} />
        </TabsContent>
        <TabsContent value={JOB_TITLE_TAB}>
          <JobTitleInsightsPanel
            selectedCountry={selectedCountry}
            onSelectCountry={setSelectedCountry}
          />
        </TabsContent>
        <TabsContent value={ORGANISATION_TAB}>
          <ComingSoon />
        </TabsContent>
      </Tabs>
    </div>
  );
}
