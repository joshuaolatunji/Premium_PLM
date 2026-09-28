import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a lazily-loaded route chunk is in flight. */
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col gap-6 p-4 sm:p-6 lg:p-10"
    >
      <span className="sr-only">Loading page…</span>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
