import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { FieldErrors } from '@acme/contracts';
import { createEmployee } from '@/api/employees';
import { ApiError } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { useReference } from '@/api/reference';
import { ErrorState, LoadingState } from '@/shared/StateViews';
import { EmployeeForm } from './EmployeeForm';
import {
  EMPTY_EMPLOYEE_FORM,
  toCreateRequest,
  type EmployeeFormValues,
} from './employeeFormValues';

const EMAIL_TAKEN = 'EMAIL_TAKEN';

/** The field errors a failed save should show next to the fields, or null for other failures. */
function toFieldErrors(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError)) return null;
  if (error.fieldErrors) return error.fieldErrors;
  if (error.code === EMAIL_TAKEN) return { email: error.message };
  return null;
}

export function AddEmployeePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reference = useReference();
  const [serverErrors, setServerErrors] = useState<FieldErrors>();
  const create = useMutation({ mutationFn: createEmployee });

  const save = async (values: EmployeeFormValues) => {
    try {
      const employee = await create.mutateAsync(toCreateRequest(values));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.insights.all }),
      ]);
      toast.success('Employee added');
      void navigate(`/employees/${employee.id}`);
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      if (!fieldErrors) {
        toast.error(error instanceof Error ? error.message : 'Could not add the employee', {
          duration: Infinity,
        });
        return;
      }
      setServerErrors(fieldErrors);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Add employee</h1>
      {reference.isError && (
        <ErrorState message={reference.error.message} onRetry={() => void reference.refetch()} />
      )}
      {reference.isPending && <LoadingState label="Loading form" />}
      {reference.data && (
        <EmployeeForm
          initialValues={EMPTY_EMPLOYEE_FORM}
          reference={reference.data}
          onSubmit={save}
          submitting={create.isPending}
          serverErrors={serverErrors}
        />
      )}
    </div>
  );
}
