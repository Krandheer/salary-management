import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const SKELETON_ROW_COUNT = 25;

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 py-10 text-center">
        <p className="text-base font-semibold">{title}</p>
        {description && <p className="text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{message}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
