'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-9 w-32 mx-auto" />
        <Skeleton className="h-80 rounded-[20px]" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
