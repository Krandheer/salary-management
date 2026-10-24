import { useState } from 'react';
import { useEmployeePage } from '@/api/employees';
import { EmptyState, ErrorState, LoadingState } from '@/shared/StateViews';
import { EmployeeTable } from './EmployeeTable';
import { PaginationBar } from './PaginationBar';

function describeTotal(total: number): string {
  return `${total.toLocaleString('en-US')} ${total === 1 ? 'employee' : 'employees'}`;
}

export function EmployeeListPage() {
  const [page, setPage] = useState(1);
  const { data, isError, error, isPending, refetch } = useEmployeePage({ page });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Employees</h1>
      {isError && <ErrorState message={error.message} onRetry={() => void refetch()} />}
      {!isError && isPending && <LoadingState label="Loading employees" />}
      {!isError && data?.total === 0 && <EmptyState title="No employees yet" />}
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
