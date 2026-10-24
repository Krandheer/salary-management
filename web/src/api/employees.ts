import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { EmployeeListPage, EmployeeStatus } from '@acme/contracts';
import { buildQueryString, requestJson } from './http';
import { queryKeys } from './queryKeys';

export interface EmployeeListParams {
  page: number;
  status?: EmployeeStatus;
}

export function fetchEmployeePage(params: EmployeeListParams): Promise<EmployeeListPage> {
  return requestJson<EmployeeListPage>(`/api/employees${buildQueryString({ ...params })}`);
}

export function useEmployeePage(params: EmployeeListParams) {
  return useQuery({
    queryKey: queryKeys.employees.page(params),
    queryFn: () => fetchEmployeePage(params),
    placeholderData: keepPreviousData,
  });
}
