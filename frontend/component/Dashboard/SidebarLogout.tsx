"use client";

import { useTranslations } from "next-intl";
import { cn, focusRing } from "@/design/ui/cn";
import LogoutIconSVG from "../svg/LogoutIconSVG";
import { useSidebarLogout } from "@/hooks/Dashboard/useSidebarLogout";

const SidebarLogout = () => {
  const { handleLogout } = useSidebarLogout();
  const t = useTranslations("shell");

  return (
    <div className="w-full">
      <button
        className={cn(
          "flex w-full items-center gap-2.5 rounded-input px-3 py-2 text-body-sm font-medium text-ink transition-colors duration-(--motion-fast) hover:bg-danger-soft hover:text-danger",
          focusRing,
        )}
        type="button"
        onClick={handleLogout}
      >
        <LogoutIconSVG width={14} />
        {t("signOut")}
      </button>
    </div>
  );
};

export default SidebarLogout;
