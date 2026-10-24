import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, FileSearch, Loader2 } from 'lucide-react';
import type { ImportResult } from '@acme/contracts';
import { confirmImport, previewImport, type ImportConfirmation } from '@/api/imports';
import { queryKeys } from '@/api/queryKeys';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCount } from '@/shared/format';
import { ImportPreviewView } from './ImportPreviewView';

/** An import changes employees and therefore every insight built on them. */
async function refreshAfterImport(
  queryClient: QueryClient,
  confirmation: ImportConfirmation,
): Promise<void> {
  if (!confirmation.isApplied) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.insights.all }),
  ]);
}

function ImportAppliedAlert({ result }: { result: ImportResult }) {
  return (
    <Alert>
      <CircleCheck aria-hidden="true" />
      <AlertTitle>Import complete</AlertTitle>
      <AlertDescription>
        {`${formatCount(result.created)} created, ${formatCount(result.updated)} updated, ` +
          `${formatCount(result.unchanged)} left unchanged`}
      </AlertDescription>
    </Alert>
  );
}

function ImportProblemAlert({ title, message }: { title: string; message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** Choose an .xlsx, see what importing it would do, then confirm to save it all or nothing. */
export function ImportPanel() {
  const queryClient = useQueryClient();
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const preview = useMutation({ mutationFn: previewImport });
  const confirmation = useMutation({
    mutationFn: confirmImport,
    onSuccess: (outcome) => refreshAfterImport(queryClient, outcome),
  });

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    preview.reset();
    confirmation.reset();
  };
  const requestPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;
    confirmation.reset();
    preview.mutate(selectedFile);
  };
  const confirm = () => {
    if (selectedFile) confirmation.mutate(selectedFile);
  };

  const outcome = confirmation.data;
  const isRejected = outcome?.isApplied === false;
  const shownPreview = isRejected ? outcome.preview : preview.data;
  const isBusy = preview.isPending || confirmation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <CardDescription>
          Check a file based on the template to see which employees it would create or update.
          Previewing saves nothing; confirming saves every row or none.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={requestPreview} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={fileInputId}>Excel file (.xlsx)</Label>
            <Input
              id={fileInputId}
              type="file"
              accept=".xlsx"
              className="h-9 w-80"
              onChange={chooseFile}
            />
          </div>
          <Button type="submit" disabled={!selectedFile || isBusy}>
            {preview.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <FileSearch aria-hidden="true" />
            )}
            Preview import
          </Button>
        </form>
        {preview.isError && (
          <ImportProblemAlert title="This file can't be imported" message={preview.error.message} />
        )}
        {outcome?.isApplied && <ImportAppliedAlert result={outcome.result} />}
        {isRejected && (
          <ImportProblemAlert
            title="The data changed since the preview"
            message="Nothing was saved. Some rows are no longer valid; they are listed below."
          />
        )}
        {confirmation.isError && (
          <ImportProblemAlert
            title="The import was not applied"
            message={confirmation.error.message}
          />
        )}
        {shownPreview && !outcome?.isApplied && (
          // A replaced preview opens fresh, on its errors tab.
          <ImportPreviewView
            key={isRejected ? 'rejected' : 'previewed'}
            preview={shownPreview}
            onConfirm={confirm}
            isConfirming={confirmation.isPending}
          />
        )}
      </CardContent>
    </Card>
  );
}
