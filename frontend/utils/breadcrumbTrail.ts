import type { BreadcrumbItem } from "@/design/ui";

/**
 * The top bar's breadcrumb on a sub-page: the menu section (a link back to it), the pages in
 * between, then this page (not a link). Without a page name, the last page in between is the
 * current one.
 */
export const breadcrumbTrail = (section: { label: string; href: string }, crumbs: BreadcrumbItem[], current?: string): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [{ label: section.label, href: section.href }, ...crumbs];
  if (current) return [...items, { label: current }];
  const last = items[items.length - 1];
  return [...items.slice(0, -1), { label: last.label }];
};
