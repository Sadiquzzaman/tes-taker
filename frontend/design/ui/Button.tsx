import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn, focusRing } from "./cn";
import Spinner from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-ink-inverse hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-ink hover:bg-canvas",
  ghost: "bg-transparent text-ink hover:bg-canvas",
  danger: "bg-danger text-ink-inverse hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-body-sm",
  md: "h-10 gap-2 px-4 text-body-sm",
  lg: "h-12 gap-2 px-5 text-body",
};

/** The classes of a button, for links or other elements that must look like one. */
export const buttonClasses = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}) =>
  cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-input font-medium",
    "transition-colors duration-(--motion-fast) ease-fast disabled:cursor-not-allowed disabled:opacity-50",
    focusRing,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and sets aria-busy. Keep the label so its width does not jump. */
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant, size, loading = false, fullWidth, leftIcon, rightIcon, className, children, disabled, type = "button", ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  ),
);
Button.displayName = "Button";

export default Button;
