import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { EmployeeListPage, EmployeeListParams, JobTitleOptions } from '@acme/contracts';
import { buildQueryString, requestJson } from './http';
import { queryKeys } from './queryKeys';

export type { EmployeeListParams };

/** The params that decide which employees are in view (everything except the page). */
export type JobTitleOptionsParams = Omit<EmployeeListParams, 'page' | 'jobTitle'>;

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

export async function fetchJobTitleOptions(params: JobTitleOptionsParams): Promise<string[]> {
  const options = await requestJson<JobTitleOptions>(
    `/api/employees/job-titles${buildQueryString({ ...params })}`,
  );
  return options.jobTitles;
}

export function useJobTitleOptions(params: JobTitleOptionsParams) {
  return useQuery({
    queryKey: queryKeys.employees.jobTitles(params),
    queryFn: () => fetchJobTitleOptions(params),
    placeholderData: keepPreviousData,
  });
}
