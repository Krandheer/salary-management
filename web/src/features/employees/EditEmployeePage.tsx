import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { EmployeeDetail, FieldErrors, ReferenceData } from '@acme/contracts';
import { updateEmployee, useEmployee } from '@/api/employees';
import { ApiError } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { useReference } from '@/api/reference';
import { EmptyState, ErrorState, LoadingState } from '@/shared/StateViews';
import { EmployeeForm } from './EmployeeForm';
import { toEditFormValues, toUpdateRequest, type EmployeeFormValues } from './employeeFormValues';
import { toFieldErrors } from './saveErrors';

interface EditFormProps {
  employee: EmployeeDetail;
  reference: ReferenceData;
}

function EditForm({ employee, reference }: EditFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverErrors, setServerErrors] = useState<FieldErrors>();
  const [initialValues] = useState(() => toEditFormValues(employee));
  const update = useMutation({
    mutationFn: (values: EmployeeFormValues) =>
      updateEmployee(employee.id, toUpdateRequest(values, initialValues)),
  });

  const save = async (values: EmployeeFormValues) => {
    try {
      await update.mutateAsync(values);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.insights.all }),
      ]);
      toast.success('Employee updated');
      void navigate(`/employees/${employee.id}`);
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      if (fieldErrors) {
        setServerErrors(fieldErrors);
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Could not update the employee', {
        duration: Infinity,
      });
    }
  };

  return (
    <EmployeeForm
      mode="edit"
      cancelTo={`/employees/${employee.id}`}
      initialValues={initialValues}
      reference={reference}
      onSubmit={save}
      submitting={update.isPending}
      serverErrors={serverErrors}
    />
  );
}

function isNotFound(error: Error): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function EditEmployeePage() {
  const { id } = useParams();
  const reference = useReference();
  const employee = useEmployee(Number(id));
  const failure = employee.error ?? reference.error;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit employee</h1>
      {failure && isNotFound(failure) && <EmptyState title="Employee not found" />}
      {failure && !isNotFound(failure) && (
        <ErrorState
          message={failure.message}
          onRetry={() => void Promise.all([employee.refetch(), reference.refetch()])}
        />
      )}
      {!failure && !(employee.data && reference.data) && <LoadingState label="Loading form" />}
      {employee.data && reference.data && (
        <EditForm employee={employee.data} reference={reference.data} />
      )}
    </div>
  );
}
