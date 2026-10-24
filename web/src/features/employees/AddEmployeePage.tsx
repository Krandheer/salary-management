import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { FieldErrors, LinkedEmployment } from '@acme/contracts';
import { checkEmail, createEmployee } from '@/api/employees';
import { queryKeys } from '@/api/queryKeys';
import { useReference } from '@/api/reference';
import { ErrorState, LoadingState } from '@/shared/StateViews';
import { EmployeeForm } from './EmployeeForm';
import { RehireNotice } from './RehireNotice';
import { toFieldErrors } from './saveErrors';
import {
  EMPTY_EMPLOYEE_FORM,
  toCreateRequest,
  type EmployeeFormValues,
} from './employeeFormValues';

export function AddEmployeePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reference = useReference();
  const [serverErrors, setServerErrors] = useState<FieldErrors>();
  const create = useMutation({ mutationFn: createEmployee });
  const [earlierRecords, setEarlierRecords] = useState<LinkedEmployment[]>([]);
  const latestCheckedEmail = useRef('');

  const lookUpEarlierRecords = async (email: string) => {
    latestCheckedEmail.current = email;
    if (!email.trim()) return setEarlierRecords([]);
    try {
      const result = await checkEmail(email);
      if (latestCheckedEmail.current === email) setEarlierRecords(result.inactiveEmployees);
    } catch {
      // The notice is a courtesy; saving still validates the email on the server.
      if (latestCheckedEmail.current === email) setEarlierRecords([]);
    }
  };

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
          mode="create"
          cancelTo="/employees"
          initialValues={EMPTY_EMPLOYEE_FORM}
          reference={reference.data}
          onSubmit={save}
          submitting={create.isPending}
          onEmailBlur={(email) => void lookUpEarlierRecords(email)}
          emailNotice={earlierRecords.length > 0 && <RehireNotice earlier={earlierRecords} />}
          serverErrors={serverErrors}
        />
      )}
    </div>
  );
}
