import type { EmployeeListParams } from './employees';

export const queryKeys = {
  employees: {
    all: ['employees'] as const,
    page: (params: EmployeeListParams) => ['employees', 'page', params] as const,
  },
  reference: ['reference'] as const,
};
