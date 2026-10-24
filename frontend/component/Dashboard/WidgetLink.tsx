import NextLink from "next/link";
import { ChevronRightIcon, cn, focusRing } from "@/design/ui";

/** "View all ›" in a dashboard card header. */
const WidgetLink = ({ href, label }: { href: string; label: string }) => (
  <NextLink
    href={href}
    className={cn("inline-flex items-center gap-0.5 rounded-sm text-body-sm font-medium text-primary hover:underline", focusRing)}
  >
    {label}
    <ChevronRightIcon className="size-3.5" />
  </NextLink>
);

export default WidgetLink;
