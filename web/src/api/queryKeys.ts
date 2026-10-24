import type { EmployeeListParams, JobTitleOptionsParams } from './employees';

export const queryKeys = {
  employees: {
    all: ['employees'] as const,
    page: (params: EmployeeListParams) => ['employees', 'page', params] as const,
    detail: (id: number) => ['employees', 'detail', id] as const,
    jobTitles: (params: JobTitleOptionsParams) => ['employees', 'jobTitles', params] as const,
  },
  insights: { all: ['insights'] as const },
  reference: ['reference'] as const,
};
