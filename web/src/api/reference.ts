import { useQuery } from '@tanstack/react-query';
import type { ReferenceData } from '@acme/contracts';
import { requestJson } from './http';
import { queryKeys } from './queryKeys';

export function fetchReference(): Promise<ReferenceData> {
  return requestJson<ReferenceData>('/api/reference');
}

export function useReference() {
  return useQuery({
    queryKey: queryKeys.reference,
    queryFn: fetchReference,
    staleTime: Infinity,
  });
}

/** Turns a country code into its display name; shows the code until the reference data has loaded. */
export function useCountryName(): (code: string) => string {
  const countries = useReference().data?.countries;
  return (code) => countries?.find((country) => country.code === code)?.name ?? code;
}
