import { CircleCheck, MinusCircle } from 'lucide-react';
import type { EmployeeStatus } from '@acme/contracts';
import { Badge } from '@/components/ui/badge';

/** Status is always icon plus text, never colour alone. */
export function StatusBadge({ status }: { status: EmployeeStatus }) {
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
