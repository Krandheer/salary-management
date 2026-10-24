import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CircleAlert, Equal, Loader2, Pencil, Plus, Upload, type LucideIcon } from 'lucide-react';
import type {
  ImportCreate,
  ImportPreview,
  ImportRowError,
  ImportTotals,
  ImportUpdate,
} from '@acme/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCount } from '@/shared/format';
import { PaginationBar } from '@/shared/PaginationBar';

const PREVIEW_PAGE_SIZE = 50;

type PreviewGroup = 'errors' | 'updates' | 'creates';

interface TotalBadge {
  key: keyof ImportTotals;
  label: string;
  Icon: LucideIcon;
  colours: string;
}

const TOTAL_BADGES: readonly TotalBadge[] = [
  {
    key: 'create',
    label: 'Create',
    Icon: Plus,
    colours: 'bg-import-create-bg text-import-create-fg',
  },
  {
    key: 'update',
    label: 'Update',
    Icon: Pencil,
    colours: 'bg-import-update-bg text-import-update-fg',
  },
  {
    key: 'unchanged',
    label: 'Unchanged',
    Icon: Equal,
    colours: 'bg-import-unchanged-bg text-import-unchanged-fg',
  },
  {
    key: 'error',
    label: 'Errors',
    Icon: CircleAlert,
    colours: 'bg-import-error-bg text-import-error-fg',
  },
];

/** Errors come first because they block the import; otherwise open the first group with rows. */
function firstGroupWithRows(preview: ImportPreview): PreviewGroup {
  if (preview.errors.length > 0) return 'errors';
  return preview.updates.length > 0 ? 'updates' : 'creates';
}

function rowLabel(row: number): string {
  return `Row ${row}`;
}

/** Counts are icon plus text, never colour alone. */
function ImportTotalsList({ totals }: { totals: ImportTotals }) {
  return (
    <ul aria-label="Import totals" className="flex flex-wrap gap-3">
      {TOTAL_BADGES.map(({ key, label, Icon, colours }) => (
        <li key={key}>
          <Badge variant="outline" className={`h-8 gap-1.5 px-3 text-sm ${colours}`}>
            <Icon aria-hidden="true" />
            {label} <span className="font-semibold tabular-nums">{formatCount(totals[key])}</span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** Shows the rows a page of 50 at a time, so a 10,000-row preview stays quick to render. */
function PagedRows<Row>({
  rows,
  emptyMessage,
  render,
}: {
  rows: readonly Row[];
  emptyMessage: string;
  render: (pageRows: readonly Row[]) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  if (rows.length === 0) return <p className="py-4 text-muted-foreground">{emptyMessage}</p>;
  const totalPages = Math.ceil(rows.length / PREVIEW_PAGE_SIZE);
  const start = (page - 1) * PREVIEW_PAGE_SIZE;
  return (
    <div className="flex flex-col gap-3">
      {render(rows.slice(start, start + PREVIEW_PAGE_SIZE))}
      {totalPages > 1 && (
        <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

function RowHeading({ row, email }: { row: number; email: string | null }) {
  return (
    <p className="flex flex-wrap gap-x-3">
      <span className="font-semibold">{rowLabel(row)}</span>
      <span className="break-all text-muted-foreground">{email ?? 'No email'}</span>
    </p>
  );
}

function ErrorRows({ errors }: { errors: readonly ImportRowError[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {errors.map((error) => (
        <li key={error.row} className="flex flex-col gap-1 px-3 py-2">
          <RowHeading row={error.row} email={error.email} />
          <ul className="list-disc pl-5 text-import-error-fg">
            {error.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function UpdateRows({ updates }: { updates: readonly ImportUpdate[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {updates.map((update) => (
        <li key={update.row} className="flex flex-col gap-1 rounded-lg border px-3 py-2">
          <RowHeading row={update.row} email={update.email} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-3">Field</TableHead>
                <TableHead className="px-3">From</TableHead>
                <TableHead className="px-3">To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {update.changes.map((change) => (
                <TableRow key={change.field}>
                  <TableCell className="px-3 py-2 font-medium">{change.field}</TableCell>
                  <TableCell className="px-3 py-2 whitespace-normal break-words">
                    {change.from}
                  </TableCell>
                  <TableCell className="px-3 py-2 whitespace-normal break-words">
                    {change.to}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </li>
      ))}
    </ul>
  );
}

function CreateNote({ rehireOf }: { rehireOf: number | null }) {
  if (rehireOf === null) return <>New employee</>;
  return (
    <>
      Rehire — linked to <Link to={`/employees/${rehireOf}`}>{`#${rehireOf}`}</Link>
    </>
  );
}

function CreateRows({ creates }: { creates: readonly ImportCreate[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Row</TableHead>
          <TableHead className="px-3">Email</TableHead>
          <TableHead className="px-3">Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {creates.map((create) => (
          <TableRow key={create.row}>
            <TableCell className="px-3 py-2 tabular-nums">{create.row}</TableCell>
            <TableCell className="max-w-[320px] truncate px-3 py-2" title={create.email}>
              {create.email}
            </TableCell>
            <TableCell className="px-3 py-2">
              <CreateNote rehireOf={create.rehireOf} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Saving is possible only once no row has errors; the note says why it isn't yet. */
function ConfirmImportBar({
  hasErrors,
  isConfirming,
  onConfirm,
}: {
  hasErrors: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
}) {
  const noteId = useId();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        onClick={onConfirm}
        disabled={hasErrors || isConfirming}
        aria-describedby={hasErrors ? noteId : undefined}
      >
        {isConfirming ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Upload aria-hidden="true" />
        )}
        Confirm import
      </Button>
      {hasErrors && (
        <p id={noteId} className="text-muted-foreground">
          Fix the rows with errors, then preview the file again to import it.
        </p>
      )}
    </div>
  );
}

interface ImportPreviewViewProps {
  preview: ImportPreview;
  onConfirm: () => void;
  isConfirming: boolean;
}

/** What an import would do, grouped by outcome. Nothing has been saved until it is confirmed. */
export function ImportPreviewView({ preview, onConfirm, isConfirming }: ImportPreviewViewProps) {
  return (
    <section aria-labelledby="import-preview-heading" className="flex flex-col gap-4">
      <h2 id="import-preview-heading" className="text-xl font-semibold">
        Preview
      </h2>
      <ImportTotalsList totals={preview.totals} />
      <ConfirmImportBar
        hasErrors={preview.totals.error > 0}
        isConfirming={isConfirming}
        onConfirm={onConfirm}
      />
      <Tabs defaultValue={firstGroupWithRows(preview)}>
        <TabsList>
          <TabsTrigger value="errors">{`Errors (${preview.errors.length})`}</TabsTrigger>
          <TabsTrigger value="updates">{`Updates (${preview.updates.length})`}</TabsTrigger>
          <TabsTrigger value="creates">{`Creates (${preview.creates.length})`}</TabsTrigger>
        </TabsList>
        <TabsContent value="errors">
          <PagedRows
            rows={preview.errors}
            emptyMessage="No rows with errors"
            render={(rows) => <ErrorRows errors={rows} />}
          />
        </TabsContent>
        <TabsContent value="updates">
          <PagedRows
            rows={preview.updates}
            emptyMessage="No employees to update"
            render={(rows) => <UpdateRows updates={rows} />}
          />
        </TabsContent>
        <TabsContent value="creates">
          <PagedRows
            rows={preview.creates}
            emptyMessage="No employees to create"
            render={(rows) => <CreateRows creates={rows} />}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
