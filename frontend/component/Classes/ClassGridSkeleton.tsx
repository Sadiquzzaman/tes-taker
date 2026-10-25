import { Skeleton } from "@/design/ui";

export const CLASS_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** Placeholder cards while classes load. */
const ClassGridSkeleton = () => (
  <div className={CLASS_GRID} aria-busy="true">
    {[0, 1, 2, 3].map((item) => (
      <div key={item} className="overflow-hidden rounded-card border border-border bg-surface">
        <Skeleton className="h-32 rounded-none" />
        <div className="p-4">
          <Skeleton lines={3} />
        </div>
      </div>
    ))}
  </div>
);

export default ClassGridSkeleton;
