import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { EmployeeDetail, IsoDate } from '@acme/contracts';
import { deleteEmployee } from '@/api/employees';
import { ApiError } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteEmployeeDialogProps {
  employee: EmployeeDetail;
  today: IsoDate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

const EXIT_DATE_ERROR_ID = 'delete-exit-date-error';

export function DeleteEmployeeDialog({
  employee,
  today,
  open,
  onOpenChange,
  onDeleted,
}: DeleteEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [exitDate, setExitDate] = useState<string>(today);
  const [exitDateError, setExitDateError] = useState<string>();
  const removal = useMutation({ mutationFn: () => deleteEmployee(employee.id, exitDate) });

  const confirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    setExitDateError(undefined);
    try {
      await removal.mutateAsync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.insights.all }),
      ]);
      toast.success('Employee deleted');
      onDeleted();
    } catch (error) {
      reportFailure(error, setExitDateError);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {employee.fullName}?</AlertDialogTitle>
          <AlertDialogDescription>
            The record is kept as inactive, with the exit date below. It can no longer be edited,
            and it stays visible with its full salary history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-exit-date">Exit date</Label>
          <Input
            id="delete-exit-date"
            type="date"
            value={exitDate}
            min={employee.hireDate}
            max={today}
            aria-invalid={Boolean(exitDateError)}
            aria-describedby={exitDateError ? EXIT_DATE_ERROR_ID : undefined}
            onChange={(event) => setExitDate(event.target.value)}
          />
          {exitDateError && (
            <p id={EXIT_DATE_ERROR_ID} className="flex items-center gap-1.5 text-destructive">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              {exitDateError}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={removal.isPending} onClick={confirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function reportFailure(error: unknown, showExitDateError: (message: string) => void): void {
  const exitDateMessage = error instanceof ApiError ? error.fieldErrors?.exitDate : undefined;
  if (exitDateMessage) {
    showExitDateError(exitDateMessage);
    return;
  }
  toast.error(error instanceof Error ? error.message : 'Could not delete the employee', {
    duration: Infinity,
  });
}
