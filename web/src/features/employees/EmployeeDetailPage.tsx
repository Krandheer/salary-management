import { Link, useParams } from 'react-router';
import { ArrowLeft, CircleCheck, MinusCircle, Pencil } from 'lucide-react';
import type { EmployeeDetail } from '@acme/contracts';
import { useEmployee } from '@/api/employees';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatSalary } from '@/shared/format';
import { ErrorState, LoadingState } from '@/shared/StateViews';

function StatusBadge({ status }: { status: EmployeeDetail['status'] }) {
  const isActive = status === 'active';
  const Icon = isActive ? CircleCheck : MinusCircle;
  const colours = isActive
    ? 'bg-status-active-bg text-status-active-fg'
    : 'bg-status-inactive-bg text-status-inactive-fg';
  return (
    <Badge variant="outline" className={colours}>
      <Icon aria-hidden="true" />
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function DetailRow({ term, children }: { term: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SalaryHistoryTable({ history }: { history: EmployeeDetail['salaryHistory'] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Effective date</TableHead>
          <TableHead className="px-3 text-right">Salary</TableHead>
          <TableHead className="px-3">Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="px-3 py-2">{formatDate(entry.effectiveDate)}</TableCell>
            <TableCell className="px-3 py-2 text-right tabular-nums">
              {formatSalary(entry.amount, entry.currency)}
            </TableCell>
            <TableCell className="px-3 py-2">{entry.reason ?? ''}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmployeeDetails({ employee }: { employee: EmployeeDetail }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{employee.fullName}</h1>
        <StatusBadge status={employee.status} />
        {employee.status === 'active' && (
          <Button variant="outline" asChild className="ml-auto">
            <Link to={`/employees/${employee.id}/edit`}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          </Button>
        )}
      </div>
      <Separator />
      <dl className="grid grid-cols-2 gap-4">
        <DetailRow term="Employee ID">{String(employee.id)}</DetailRow>
        <DetailRow term="Work email">{employee.email}</DetailRow>
        <DetailRow term="Job title">{employee.jobTitle}</DetailRow>
        <DetailRow term="Department">{employee.department}</DetailRow>
        <DetailRow term="Country">{employee.country}</DetailRow>
        <DetailRow term="Currency">{employee.currency}</DetailRow>
        <DetailRow term="Employment type">{employee.employmentType}</DetailRow>
        <DetailRow term="Hire date">{formatDate(employee.hireDate)}</DetailRow>
        <DetailRow term="Current salary">
          {formatSalary(employee.currentSalary, employee.currency)}
        </DetailRow>
      </dl>
      <h2 className="text-xl font-semibold">Salary history</h2>
      <SalaryHistoryTable history={employee.salaryHistory} />
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
