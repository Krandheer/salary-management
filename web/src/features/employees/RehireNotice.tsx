import { Link } from 'react-router';
import { Info } from 'lucide-react';
import type { LinkedEmployment } from '@acme/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Shown before saving when the email belonged to inactive employees (newest exit first). */
export function RehireNotice({ earlier }: { earlier: LinkedEmployment[] }) {
  return (
    <Alert>
      <Info aria-hidden="true" />
      <AlertTitle>This email belonged to an inactive employee</AlertTitle>
      <AlertDescription>
        <ul>
          {earlier.map((item) => (
            <li key={item.id}>
              {item.fullName} (ID {item.id}), hired {item.hireDate}, left {item.exitDate}.{' '}
              <Link to={`/employees/${item.id}`} aria-label={`Open employee ${item.id}`}>
                Open
              </Link>
            </li>
          ))}
        </ul>
        <p>
          Saving creates a new employee record linked to the earlier one. The hire date must be
          after the most recent exit date.
        </p>
      </AlertDescription>
    </Alert>
  );
}
