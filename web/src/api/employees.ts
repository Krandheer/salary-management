import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  CreateEmployeeRequest,
  EmployeeDetail,
  EmployeeListPage,
  EmployeeListParams,
  JobTitleOptions,
  UpdateEmployeeRequest,
} from '@acme/contracts';
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

export function createEmployee(request: CreateEmployeeRequest): Promise<EmployeeDetail> {
  return requestJson<EmployeeDetail>('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function updateEmployee(
  id: number,
  request: UpdateEmployeeRequest,
): Promise<EmployeeDetail> {
  return requestJson<EmployeeDetail>(`/api/employees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function fetchEmployee(id: number): Promise<EmployeeDetail> {
  return requestJson<EmployeeDetail>(`/api/employees/${id}`);
}

export function useEmployee(id: number) {
  return useQuery({ queryKey: queryKeys.employees.detail(id), queryFn: () => fetchEmployee(id) });
}
