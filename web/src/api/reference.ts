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
