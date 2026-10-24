import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { EmployeeDetail } from '@acme/contracts';
import { useReference } from '@/api/reference';
import { Button } from '@/components/ui/button';
import { DeleteEmployeeDialog } from './DeleteEmployeeDialog';

/** The "Delete" button and its confirmation; it waits for the server's date, which limits the exit date. */
export function DeleteEmployeeAction({ employee }: { employee: EmployeeDetail }) {
  const [isOpen, setIsOpen] = useState(false);
  const today = useReference().data?.today;
  if (!today) return null;

  return (
    <>
      <Button variant="destructive" onClick={() => setIsOpen(true)}>
        <Trash2 aria-hidden="true" />
        Delete
      </Button>
      <DeleteEmployeeDialog
        employee={employee}
        today={today}
        open={isOpen}
        onOpenChange={setIsOpen}
        onDeleted={() => setIsOpen(false)}
      />
    </>
  );
}
