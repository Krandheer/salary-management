import { useQuery } from '@tanstack/react-query';
import type {
  CountryCode,
  CountryInsights,
  CountryJobTitleInsights,
  OrganisationComparison,
} from '@acme/contracts';
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

export function fetchOrganisationComparison(): Promise<OrganisationComparison> {
  return requestJson<OrganisationComparison>('/api/insights/organisation');
}

/** Always refetched when shown, so the figures never lag behind a change. */
export function useOrganisationComparison() {
  return useQuery({
    queryKey: queryKeys.insights.organisation,
    queryFn: fetchOrganisationComparison,
    staleTime: 0,
  });
}
