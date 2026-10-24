import { useQuery } from '@tanstack/react-query';
import type { CountryInsights } from '@acme/contracts';
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
