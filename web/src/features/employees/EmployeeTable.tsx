import type { EmployeeSummary } from '@acme/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatSalary } from '@/shared/format';

function TruncatedCell({ text }: { text: string }) {
  return (
    <TableCell className="max-w-[20ch] truncate px-3 py-2" title={text}>
      {text}
    </TableCell>
  );
}

export function EmployeeTable({ employees }: { employees: EmployeeSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Name</TableHead>
          <TableHead className="px-3">Job title</TableHead>
          <TableHead className="px-3">Department</TableHead>
          <TableHead className="px-3">Country</TableHead>
          <TableHead className="px-3 text-right">Salary</TableHead>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
