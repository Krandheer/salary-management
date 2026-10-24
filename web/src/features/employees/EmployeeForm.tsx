import { useEffect, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { Link } from 'react-router';
import { CircleAlert, Loader2 } from 'lucide-react';
import type { FieldErrors, ReferenceData } from '@acme/contracts';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EmployeeFormValues } from './employeeFormValues';

interface EmployeeFormProps {
  /** Create asks for the salary; edit offers an optional new salary. */
  mode: 'create' | 'edit';
  /** Where Cancel goes. */
  cancelTo: string;
  initialValues: EmployeeFormValues;
  reference: ReferenceData;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
  submitting: boolean;
  /** Messages from the server, shown next to the field they name. */
  serverErrors?: FieldErrors;
}

type FieldName = FieldPath<EmployeeFormValues>;

interface FormFieldProps {
  name: FieldName;
  label: string;
  error: string | undefined;
  isRequired?: boolean;
  children: (aria: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}

function FormField({ name, label, error, isRequired = true, children }: FormFieldProps) {
  const id = `employee-${name}`;
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {isRequired && (
          <>
            <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </FieldLabel>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <FieldError id={errorId} className="flex items-center gap-1.5">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </FieldError>
      )}
    </Field>
  );
}

export function EmployeeForm({
  mode,
  cancelTo,
  initialValues,
  reference,
  onSubmit,
  submitting,
  serverErrors,
}: EmployeeFormProps) {
  const { register, control, handleSubmit, setError, setFocus, formState } =
    useForm<EmployeeFormValues>({ defaultValues: initialValues, mode: 'onBlur' });
  const isEdit = mode === 'edit';
  const messageFor = (name: FieldName) => formState.errors[name]?.message;
  const chosenCountry = useWatch({ control, name: 'country' });
  const currency = reference.countries.find((country) => country.code === chosenCountry)?.currency;

  useEffect(() => {
    const entries = Object.entries(serverErrors ?? {});
    for (const [name, message] of entries) {
      setError(name as FieldName, { type: 'server', message });
    }
    const [firstName] = entries[0] ?? [];
    if (firstName) setFocus(firstName as FieldName);
  }, [serverErrors, setError, setFocus]);

  const selectField = (
    name: FieldName,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <FormField name={name} label={label} error={messageFor(name)}>
      {(aria) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger {...aria} onBlur={field.onBlur} className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </FormField>
  );

  const textField = (name: FieldName, label: string, inputProps: object = {}) => (
    <FormField name={name} label={label} error={messageFor(name)}>
      {(aria) => <Input {...aria} {...register(name)} {...inputProps} />}
    </FormField>
  );

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-[560px] flex-col gap-6"
    >
      <FieldSet>
        <FieldLegend>Identity</FieldLegend>
        {textField('fullName', 'Full name')}
        {textField('email', 'Work email', { type: 'email', autoComplete: 'off' })}
      </FieldSet>
      <FieldSet>
        <FieldLegend>Role</FieldLegend>
        {textField('jobTitle', 'Job title')}
        {selectField(
          'department',
          'Department',
          reference.departments.map((name) => ({ value: name, label: name })),
        )}
        {selectField(
          'country',
          'Country',
          reference.countries.map(({ code, name }) => ({ value: code, label: name })),
        )}
        {selectField(
          'employmentType',
          'Employment type',
          reference.employmentTypes.map((name) => ({ value: name, label: name })),
        )}
        {textField('hireDate', 'Hire date', { type: 'date', max: reference.today })}
      </FieldSet>
      <FieldSet>
        <FieldLegend>{isEdit ? 'Change salary' : 'Pay'}</FieldLegend>
        <FormField
          name="annualSalary"
          label={isEdit ? 'New annual salary' : 'Annual salary'}
          isRequired={!isEdit}
          error={messageFor('annualSalary')}
        >
          {(aria) => (
            <div className="flex items-center gap-2">
              <span className="w-12 text-muted-foreground">{currency}</span>
              <Input {...aria} {...register('annualSalary')} inputMode="numeric" />
            </div>
          )}
        </FormField>
        {isEdit && (
          <p className="text-sm text-muted-foreground">
            Leave empty to keep the current salary. Required when the country changes.
          </p>
        )}
      </FieldSet>
      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save
        </Button>
        <Button variant="ghost" asChild>
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
