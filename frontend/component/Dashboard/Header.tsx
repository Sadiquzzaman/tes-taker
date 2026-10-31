import sidebarList from "@/utils/sidebarList";
import { getTranslations } from "next-intl/server";
import LanguageSwitcher from "../Layout/LanguageSwitcher";
import NotificationBell from "../Notifications/NotificationBell";
import HeaderProfile from "./HeaderProfile";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

/** The page title in the top bar: the matching sidebar item, then the optional sub-page ("Classes / Physics 9A"). */
const Header = async ({ activeRoute, subText = "" }: { activeRoute: string; subText?: string }) => {
  const t = await getTranslations();
  const matched =
    sidebarList.find((item) => item.route === activeRoute) ||
    sidebarList.find((item) => activeRoute.startsWith(item.route) && item.route !== "/");

  if (!matched) {
    return <span className="text-ink">{subText || t("shell.organization")}</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-ink-muted">{matched.image}</span>
      <span className={subText ? "text-ink-muted" : "text-ink"}>{t(`nav.${matched.label}`)}</span>
      {subText ? <span className="truncate text-ink">/ {subText}</span> : null}
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
