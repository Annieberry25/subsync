'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function PageLoading({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10">
      {withHeader && (
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Skeleton className="h-[104px] rounded-2xl" />
        <Skeleton className="h-[104px] rounded-2xl" />
        <Skeleton className="h-[104px] rounded-2xl" />
        <Skeleton className="h-[104px] rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-[20px]" />
        <Skeleton className="h-64 rounded-[20px]" />
      </div>
    </div>
  );
}
