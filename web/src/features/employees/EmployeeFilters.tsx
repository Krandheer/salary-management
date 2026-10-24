import type { ReferenceData } from '@acme/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** What the HR Manager has typed or chosen; an empty string means "no filter". */
export interface EmployeeFiltersValue {
  search: string;
  country: string;
  department: string;
  jobTitle: string;
}

export const NO_FILTERS: EmployeeFiltersValue = {
  search: '',
  country: '',
  department: '',
  jobTitle: '',
};

const ALL = '__all__';

interface FilterSelectProps {
  id: string;
  label: string;
  allLabel: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({ id, label, allLabel, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
        <SelectTrigger id={id} className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface EmployeeFiltersProps {
  value: EmployeeFiltersValue;
  onChange: (value: EmployeeFiltersValue) => void;
  onClear: () => void;
  reference: ReferenceData;
  jobTitleOptions: string[];
}

export function EmployeeFilters({
  value,
  onChange,
  onClear,
  reference,
  jobTitleOptions,
}: EmployeeFiltersProps) {
  const change = (patch: Partial<EmployeeFiltersValue>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employee-search">Search name</Label>
        <Input
          id="employee-search"
          className="w-64"
          value={value.search}
          onChange={(event) => change({ search: event.target.value })}
        />
      </div>
      <FilterSelect
        id="employee-country"
        label="Country"
        allLabel="All countries"
        value={value.country}
        options={reference.countries.map(({ code, name }) => ({ value: code, label: name }))}
        onChange={(country) => change({ country })}
      />
      <FilterSelect
        id="employee-department"
        label="Department"
        allLabel="All departments"
        value={value.department}
        options={reference.departments.map((name) => ({ value: name, label: name }))}
        onChange={(department) => change({ department })}
      />
      <FilterSelect
        id="employee-job-title"
        label="Job title"
        allLabel="All job titles"
        value={value.jobTitle}
        options={jobTitleOptions.map((title) => ({ value: title, label: title }))}
        onChange={(jobTitle) => change({ jobTitle })}
      />
      <Button variant="ghost" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
