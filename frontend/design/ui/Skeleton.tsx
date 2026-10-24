import { cn } from "./cn";

export interface SkeletonProps {
  /** Number of text lines (the last one is shorter). Ignored when `className` sets a size. */
  lines?: number;
  className?: string;
}

/** A grey placeholder shown while content loads. Hidden from screen readers: mark the region aria-busy instead. */
const Skeleton = ({ lines, className }: SkeletonProps) => {
  const block = "rounded-input bg-border/70 motion-safe:animate-pulse";

  if (lines && lines > 0) {
    return (
      <div aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className={cn(block, "h-3", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    );
  }

  return <div aria-hidden="true" className={cn(block, "h-4 w-full", className)} />;
};

export default Skeleton;
