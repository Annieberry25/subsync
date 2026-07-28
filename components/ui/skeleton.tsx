'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-env-button-sec animate-pulse rounded-xl ${className}`} />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="glass-panel p-5 rounded-2xl space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="w-7 h-7 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function SubscriptionCardSkeleton() {
  return (
    <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      <div className="pt-2 border-t border-env-main grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center gap-1">
          <Skeleton className="w-8 h-8 rounded-xl" />
          <Skeleton className="w-8 h-8 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsChartSkeleton() {
  return (
    <div className="glass-panel p-6 rounded-3xl space-y-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-5 h-5 rounded-md" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-4 w-full rounded-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3.5 rounded-xl bg-env-button-sec border border-env-main flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-3 h-3 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="space-y-1 text-right">
              <Skeleton className="h-3.5 w-16 ml-auto" />
              <Skeleton className="h-3 w-10 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
