import { useState } from 'react';
import { Link } from 'react-router';
import type { EmployeeStatus } from '@acme/contracts';
import { useEmployeePage, useJobTitleOptions, type EmployeeListParams } from '@/api/employees';
import { useReference } from '@/api/reference';
import { buildExportUrl } from '@/api/spreadsheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PaginationBar } from '@/shared/PaginationBar';
import { EmptyState, ErrorState, LoadingState } from '@/shared/StateViews';
import { useDebouncedValue } from '@/shared/useDebouncedValue';
import { EmployeeFilters, NO_FILTERS, type EmployeeFiltersValue } from './EmployeeFilters';
import { EmployeeTable } from './EmployeeTable';

const SEARCH_DEBOUNCE_MS = 300;
const FIRST_PAGE = 1;

function describeTotal(total: number): string {
  return `${total.toLocaleString('en-US')} ${total === 1 ? 'employee' : 'employees'}`;
}

function describeNoMatch(hasFilters: boolean, isShowingInactive: boolean): string {
  if (hasFilters) return 'No matching employees';
  return isShowingInactive ? 'No inactive employees' : 'No employees yet';
}

function hasActiveFilters(filters: EmployeeFiltersValue): boolean {
  return Object.values(filters).some((value) => value.trim() !== '');
}

/** Only the filters that are set become request params. */
function toViewParams(filters: EmployeeFiltersValue): Omit<EmployeeListParams, 'page' | 'status'> {
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
  const [isShowingInactive, setIsShowingInactive] = useState(false);
  const search = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);
  const status: EmployeeStatus | undefined = isShowingInactive ? 'inactive' : undefined;
  const viewParams = { ...toViewParams({ ...filters, search }), status };
  const { data, isError, error, isPending, refetch } = useEmployeePage({ ...viewParams, page });
  const reference = useReference();
  const jobTitleOptions = useJobTitleOptions({
    search: viewParams.search,
    country: viewParams.country,
    department: viewParams.department,
    status,
  });

  const changeFilters = (next: EmployeeFiltersValue) => {
    setFilters(next);
    setPage(FIRST_PAGE);
  };
  const toggleInactive = (isOn: boolean) => {
    setIsShowingInactive(isOn);
    setPage(FIRST_PAGE);
  };
  const noMatchTitle = describeNoMatch(hasActiveFilters(filters), isShowingInactive);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={buildExportUrl(viewParams)}>Export .xlsx</a>
          </Button>
          <Button asChild>
            <Link to="/employees/new">Add employee</Link>
          </Button>
        </div>
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
      <div className="flex items-center gap-2">
        <Switch id="show-inactive" checked={isShowingInactive} onCheckedChange={toggleInactive} />
        <Label htmlFor="show-inactive">Show inactive employees</Label>
      </div>
      {isError && <ErrorState message={error.message} onRetry={() => void refetch()} />}
      {!isError && isPending && <LoadingState label="Loading employees" />}
      {!isError && data?.total === 0 && <EmptyState title={noMatchTitle} />}
      {!isError && data && data.total > 0 && (
        <>
          <p className="text-muted-foreground">{describeTotal(data.total)}</p>
          <EmployeeTable employees={data.items} showExitDate={isShowingInactive} />
          <PaginationBar page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
