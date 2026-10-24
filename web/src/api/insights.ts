import { useQuery } from '@tanstack/react-query';
import type { CountryCode, CountryInsights, CountryJobTitleInsights } from '@acme/contracts';
import { requestJson } from './http';
import { queryKeys } from './queryKeys';

export function fetchCountryInsights(): Promise<CountryInsights> {
  return requestJson<CountryInsights>('/api/insights/countries');
}

/** Always refetched when shown, so the figures never lag behind a change. */
export function useCountryInsights() {
  return useQuery({
    queryKey: queryKeys.insights.countries,
    queryFn: fetchCountryInsights,
    staleTime: 0,
  });
}

export function fetchJobTitleInsights(country: CountryCode): Promise<CountryJobTitleInsights> {
  return requestJson<CountryJobTitleInsights>(`/api/insights/countries/${country}/job-titles`);
}

export function useJobTitleInsights(country: CountryCode | undefined) {
  return useQuery({
    queryKey: queryKeys.insights.jobTitles(country ?? ''),
    queryFn: () => fetchJobTitleInsights(country!),
    enabled: country !== undefined,
    staleTime: 0,
  });
}
