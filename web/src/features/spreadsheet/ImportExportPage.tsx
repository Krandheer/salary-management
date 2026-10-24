import { Download } from 'lucide-react';
import { buildExportUrl, TEMPLATE_DOWNLOAD_URL } from '@/api/spreadsheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ImportExportPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Import / Export</h1>
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Download all active employees as an Excel file. To export a filtered list, use the
            Export button on the Employees page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={buildExportUrl()}>
              <Download aria-hidden="true" />
              Export current list
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={TEMPLATE_DOWNLOAD_URL}>
              <Download aria-hidden="true" />
              Download template
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
