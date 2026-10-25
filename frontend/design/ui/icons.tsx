import type { SVGProps } from "react";
import { cn } from "./cn";

/** Small 16px line icons used inside the components. Decorative (aria-hidden); label the control instead. */
const Icon = ({ className, children, ...rest }: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("size-4 shrink-0", className)}
    {...rest}
  >
    {children}
  </svg>
);

type IconProps = { className?: string };

export const ChevronDownIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m4 6 4 4 4-4" />
  </Icon>
);
export const ChevronUpIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m4 10 4-4 4 4" />
  </Icon>
);
export const ChevronLeftIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m10 4-4 4 4 4" />
  </Icon>
);
export const ChevronRightIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m6 4 4 4-4 4" />
  </Icon>
);
export const CheckIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m3.5 8.5 3 3 6-7" />
  </Icon>
);
export const CloseIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);
export const SearchIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3 3" />
  </Icon>
);
export const MenuIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
  </Icon>
);
export const UploadIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" />
  </Icon>
);
export const AlertIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3.5M8 11h.01" />
  </Icon>
);
export const InboxIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M2 9.5 3.5 3h9L14 9.5V13H2V9.5ZM2 9.5h3.5l1 1.5h3l1-1.5H14" />
  </Icon>
);
export const ArrowUpIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M8 13V3M4 7l4-4 4 4" />
  </Icon>
);
export const ArrowDownIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </Icon>
);
export const SortIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
  </Icon>
);
export const EyeIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="2" />
  </Icon>
);
export const EyeOffIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M6.6 3.7A6 6 0 0 1 8 3.5c4 0 6.5 4.5 6.5 4.5a11 11 0 0 1-1.7 2.2M4.2 4.9A11 11 0 0 0 1.5 8S4 12.5 8 12.5a6 6 0 0 0 3-.8" />
    <path d="M6.6 6.6a2 2 0 0 0 2.8 2.8M2 2l12 12" />
  </Icon>
);
