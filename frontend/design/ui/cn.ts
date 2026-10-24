/** Joins class names, skipping empty ones: cn("a", isOn && "b") -> "a b". */
export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

/** The focus ring every interactive component uses (keyboard focus only). */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
