import { Breadcrumb, type BreadcrumbItem } from "@/design/ui";
import { breadcrumbTrail } from "@/utils/breadcrumbTrail";
import sidebarList from "@/utils/sidebarList";
import { getTranslations } from "next-intl/server";
import LanguageSwitcher from "../Layout/LanguageSwitcher";
import NotificationBell from "../Notifications/NotificationBell";
import HeaderProfile from "./HeaderProfile";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

/**
 * The page title in the top bar: the matching sidebar item, then the optional sub-page
 * ("Classes / Physics 9A"). On a sub-page (`crumbs` given) it is a breadcrumb whose section and
 * in-between pages are links, so the person can go back without the browser's Back button.
 */
const Header = async ({ activeRoute, subText = "", crumbs }: { activeRoute: string; subText?: string; crumbs?: BreadcrumbItem[] }) => {
  const t = await getTranslations();
  const matched =
    sidebarList.find((item) => item.route === activeRoute) ||
    sidebarList.find((item) => activeRoute.startsWith(item.route) && item.route !== "/");

  if (!matched) {
    return <span className="text-ink">{subText || t("shell.organization")}</span>;
  }

  if (crumbs) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-ink-muted">{matched.image}</span>
        <Breadcrumb className="min-w-0" items={breadcrumbTrail({ label: t(`nav.${matched.label}`), href: matched.route }, crumbs, subText || undefined)} />
      </span>
    );
  }

  // A page named like its menu section ("Chat") is said once, not "Chat / Chat".
  const section = t(`nav.${matched.label}`);
  const page = subText && subText !== section ? subText : "";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-ink-muted">{matched.image}</span>
      <span className={page ? "text-ink-muted" : "text-ink"}>{section}</span>
      {page ? <span className="truncate text-ink">/ {page}</span> : null}
    </span>
  );
};

/** Right side of the top bar: workspace, the notifications bell (P2-08), language and profile. */
export const HeaderActions = () => (
  <>
    <WorkspaceSwitcher />
    <NotificationBell />
    <LanguageSwitcher />
    <HeaderProfile />
  </>
);

export default Header;
