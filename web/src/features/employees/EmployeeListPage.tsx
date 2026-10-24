import { useState } from 'react';
import { Link } from 'react-router';
import type { EmployeeStatus } from '@acme/contracts';
import { useEmployeePage, useJobTitleOptions, type EmployeeListParams } from '@/api/employees';
import { useReference } from '@/api/reference';
import { buildExportUrl } from '@/api/spreadsheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatCount } from '@/shared/format';
import { PaginationBar } from '@/shared/PaginationBar';
import { EmptyState, ErrorState, LoadingState } from '@/shared/StateViews';
import { useDebouncedValue } from '@/shared/useDebouncedValue';
import { EmployeeFilters, NO_FILTERS, type EmployeeFiltersValue } from './EmployeeFilters';
import { EmployeeTable } from './EmployeeTable';

const SEARCH_DEBOUNCE_MS = 300;
const FIRST_PAGE = 1;

function describeTotal(total: number): string {
  return `${formatCount(total)} ${total === 1 ? 'employee' : 'employees'}`;
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

/** The page within the view; any change to the applied view (its key) returns to page 1. */
function usePageOfView(viewKey: string): [number, (page: number) => void] {
  const [pageOfView, setPageOfView] = useState({ viewKey, page: FIRST_PAGE });
  if (pageOfView.viewKey !== viewKey) setPageOfView({ viewKey, page: FIRST_PAGE });
  const page = pageOfView.viewKey === viewKey ? pageOfView.page : FIRST_PAGE;
  return [page, (next) => setPageOfView({ viewKey, page: next })];
}

export function EmployeeListPage() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [isShowingInactive, setIsShowingInactive] = useState(false);
  const [search, applySearchNow] = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);
  const status: EmployeeStatus | undefined = isShowingInactive ? 'inactive' : undefined;
  const viewParams = { ...toViewParams({ ...filters, search }), status };
  const [page, setPage] = usePageOfView(JSON.stringify(viewParams));
  const { data, isError, error, isPending, refetch } = useEmployeePage({ ...viewParams, page });
  const reference = useReference();
  const jobTitleOptions = useJobTitleOptions({
    search: viewParams.search,
    country: viewParams.country,
    department: viewParams.department,
    status,
  });

  const clearFilters = () => {
    setFilters(NO_FILTERS);
    applySearchNow(NO_FILTERS.search);
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
          onChange={setFilters}
          onClear={clearFilters}
          reference={reference.data}
          jobTitleOptions={jobTitleOptions.data ?? []}
        />
      )}
      <div className="flex items-center gap-2">
        <Switch
          id="show-inactive"
          checked={isShowingInactive}
          onCheckedChange={setIsShowingInactive}
        />
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
