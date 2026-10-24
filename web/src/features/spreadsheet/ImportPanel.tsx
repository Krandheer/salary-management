import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CircleAlert, FileSearch, Loader2 } from 'lucide-react';
import { previewImport } from '@/api/imports';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImportPreviewView } from './ImportPreviewView';

/** Choose an .xlsx and see what importing it would do; the chosen file is kept for confirming. */
export function ImportPanel() {
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const preview = useMutation({ mutationFn: previewImport });

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    preview.reset();
  };
  const requestPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedFile) preview.mutate(selectedFile);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <CardDescription>
          Check a file based on the template to see which employees it would create or update.
          Previewing saves nothing.
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
          <Button type="submit" disabled={!selectedFile || preview.isPending}>
            {preview.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <FileSearch aria-hidden="true" />
            )}
            Preview import
          </Button>
        </form>
        {preview.isError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>This file can't be imported</AlertTitle>
            <AlertDescription>{preview.error.message}</AlertDescription>
          </Alert>
        )}
        {preview.data && <ImportPreviewView preview={preview.data} />}
      </CardContent>
    </Card>
  );
}
