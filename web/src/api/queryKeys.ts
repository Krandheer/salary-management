import type { EmployeeListParams, JobTitleOptionsParams } from './employees';

export const queryKeys = {
  employees: {
    all: ['employees'] as const,
    page: (params: EmployeeListParams) => ['employees', 'page', params] as const,
    jobTitles: (params: JobTitleOptionsParams) => ['employees', 'jobTitles', params] as const,
  },
  reference: ['reference'] as const,
};
