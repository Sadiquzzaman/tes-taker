import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn, focusRing } from "./cn";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Required: what the button does, read by screen readers and shown as a tooltip. */
  label: string;
  icon: ReactNode;
  variant?: "ghost" | "secondary";
  size?: "sm" | "md";
}

/** A square button with only an icon. */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, variant = "ghost", size = "md", className, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-input text-ink transition-colors duration-(--motion-fast) ease-fast",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        variant === "ghost" ? "hover:bg-canvas" : "border border-border bg-surface hover:bg-canvas",
        size === "sm" ? "size-8" : "size-10",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  ),
);
IconButton.displayName = "IconButton";

export default IconButton;
