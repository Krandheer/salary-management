import { Link, useParams } from 'react-router';
import { ArrowLeft, Pencil } from 'lucide-react';
import type { EmployeeDetail } from '@acme/contracts';
import { useEmployee } from '@/api/employees';
import { useCountryName } from '@/api/reference';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatDate, formatSalary } from '@/shared/format';
import { ErrorState, LoadingState } from '@/shared/StateViews';
import { StatusBadge } from '@/shared/StatusBadge';
import { DeleteEmployeeAction } from './DeleteEmployeeAction';
import { LinkedEmploymentsList } from './LinkedEmploymentsList';
import { SalaryHistoryTable } from './SalaryHistoryTable';

function DetailRow({ term, children }: { term: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function EmployeeDetails({ employee }: { employee: EmployeeDetail }) {
  const countryName = useCountryName();
  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{employee.fullName}</h1>
        <StatusBadge status={employee.status} />
        {employee.status === 'active' && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/employees/${employee.id}/edit`}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </Button>
            <DeleteEmployeeAction employee={employee} />
          </div>
        )}
      </div>
      <Separator />
      <dl className="grid grid-cols-2 gap-4">
        <DetailRow term="Employee ID">{String(employee.id)}</DetailRow>
        <DetailRow term="Work email">{employee.email}</DetailRow>
        <DetailRow term="Job title">{employee.jobTitle}</DetailRow>
        <DetailRow term="Department">{employee.department}</DetailRow>
        <DetailRow term="Country">{countryName(employee.country)}</DetailRow>
        <DetailRow term="Currency">{employee.currency}</DetailRow>
        <DetailRow term="Employment type">{employee.employmentType}</DetailRow>
        <DetailRow term="Hire date">{formatDate(employee.hireDate)}</DetailRow>
        {employee.exitDate && (
          <DetailRow term="Exit date">{formatDate(employee.exitDate)}</DetailRow>
        )}
        <DetailRow term="Current salary">
          {formatSalary(employee.currentSalary, employee.currency)}
        </DetailRow>
      </dl>
      <h2 className="text-xl font-semibold">Salary history</h2>
      <SalaryHistoryTable entries={employee.salaryHistory} />
      {employee.linkedEmployments.length > 0 && (
        <>
          <h2 className="text-xl font-semibold">Linked employment records</h2>
          <LinkedEmploymentsList items={employee.linkedEmployments} />
        </>
      )}
    </>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams();
  const { data, isError, error, isPending, refetch } = useEmployee(Number(id));

  return (
    <div className="flex flex-col gap-6">
      <Link to="/employees" className="flex w-fit items-center gap-1 text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to employees
      </Link>
      {isError && <ErrorState message={error.message} onRetry={() => void refetch()} />}
      {isPending && <LoadingState label="Loading employee" />}
      {data && <EmployeeDetails employee={data} />}
    </div>
  );
}
