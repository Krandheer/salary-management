import { useState } from 'react';
import { Link } from 'react-router';
import { useEmployeePage, useJobTitleOptions, type EmployeeListParams } from '@/api/employees';
import { useReference } from '@/api/reference';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/StateViews';
import { useDebouncedValue } from '@/shared/useDebouncedValue';
import { EmployeeFilters, NO_FILTERS, type EmployeeFiltersValue } from './EmployeeFilters';
import { EmployeeTable } from './EmployeeTable';
import { PaginationBar } from './PaginationBar';

const SEARCH_DEBOUNCE_MS = 300;
const FIRST_PAGE = 1;

function describeTotal(total: number): string {
  return `${total.toLocaleString('en-US')} ${total === 1 ? 'employee' : 'employees'}`;
}

function hasActiveFilters(filters: EmployeeFiltersValue): boolean {
  return Object.values(filters).some((value) => value.trim() !== '');
}

/** Only the filters that are set become request params. */
function toViewParams(filters: EmployeeFiltersValue): Omit<EmployeeListParams, 'page'> {
  return {
    search: filters.search.trim() || undefined,
    country: (filters.country || undefined) as EmployeeListParams['country'],
    department: filters.department || undefined,
    jobTitle: filters.jobTitle || undefined,
  };
}

export function EmployeeListPage() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(FIRST_PAGE);
  const search = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);
  const viewParams = toViewParams({ ...filters, search });
  const { data, isError, error, isPending, refetch } = useEmployeePage({ ...viewParams, page });
  const reference = useReference();
  const jobTitleOptions = useJobTitleOptions({
    search: viewParams.search,
    country: viewParams.country,
    department: viewParams.department,
  });

  const changeFilters = (next: EmployeeFiltersValue) => {
    setFilters(next);
    setPage(FIRST_PAGE);
  };
  const noMatchTitle = hasActiveFilters(filters) ? 'No matching employees' : 'No employees yet';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <Button asChild>
          <Link to="/employees/new">Add employee</Link>
        </Button>
      </div>
      {reference.data && (
        <EmployeeFilters
          value={filters}
          onChange={changeFilters}
          onClear={() => changeFilters(NO_FILTERS)}
          reference={reference.data}
          jobTitleOptions={jobTitleOptions.data ?? []}
        />
      )}
      {isError && <ErrorState message={error.message} onRetry={() => void refetch()} />}
      {!isError && isPending && <LoadingState label="Loading employees" />}
      {!isError && data?.total === 0 && <EmptyState title={noMatchTitle} />}
      {!isError && data && data.total > 0 && (
        <>
          <p className="text-muted-foreground">{describeTotal(data.total)}</p>
          <EmployeeTable employees={data.items} />
          <PaginationBar page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
