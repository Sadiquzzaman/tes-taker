import { cn } from "./cn";

/** A small spinning circle for loading buttons and areas. Decorative: announce loading with text or aria-busy. */
const Spinner = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    className={cn("size-4 shrink-0 motion-safe:animate-spin", className)}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export default Spinner;
