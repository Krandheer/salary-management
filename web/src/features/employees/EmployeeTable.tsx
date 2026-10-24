import type { EmployeeSummary } from '@acme/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatSalary } from '@/shared/format';

function TruncatedCell({ text }: { text: string }) {
  return (
    <TableCell className="max-w-[20ch] truncate px-3 py-2" title={text}>
      {text}
    </TableCell>
  );
}

interface EmployeeTableProps {
  employees: EmployeeSummary[];
  /** Inactive employees have left; the list then shows when. */
  showExitDate?: boolean;
}

export function EmployeeTable({ employees, showExitDate = false }: EmployeeTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Name</TableHead>
          <TableHead className="px-3">Job title</TableHead>
          <TableHead className="px-3">Department</TableHead>
          <TableHead className="px-3">Country</TableHead>
          <TableHead className="px-3 text-right">Salary</TableHead>
          {showExitDate && <TableHead className="px-3">Exit date</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TruncatedCell text={employee.fullName} />
            <TruncatedCell text={employee.jobTitle} />
            <TruncatedCell text={employee.department} />
            <TableCell className="px-3 py-2">{employee.country}</TableCell>
            <TableCell className="px-3 py-2 text-right tabular-nums">
              {formatSalary(employee.currentSalary, employee.currency)}
            </TableCell>
            {showExitDate && (
              <TableCell className="px-3 py-2">
                {employee.exitDate ? formatDate(employee.exitDate) : '—'}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
