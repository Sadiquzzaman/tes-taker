import NextLink from "next/link";
import type { ComponentProps } from "react";
import { cn, focusRing } from "./cn";

export interface LinkProps extends ComponentProps<typeof NextLink> {
  /** Opens in a new tab, safely (rel="noopener noreferrer"). */
  external?: boolean;
  /** "inline" is underlined text; "plain" only changes colour on hover (for nav and cards). */
  variant?: "inline" | "plain";
}

/** A text link. For a link that looks like a button, use `buttonClasses()` on a Next Link. */
const Link = ({ external = false, variant = "inline", className, ...rest }: LinkProps) => (
  <NextLink
    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    className={cn(
      "rounded-sm font-medium text-primary transition-colors duration-(--motion-fast) hover:text-primary-hover",
      variant === "inline" ? "underline underline-offset-2" : "no-underline hover:underline",
      focusRing,
      className,
    )}
    {...rest}
  />
);

export default Link;
