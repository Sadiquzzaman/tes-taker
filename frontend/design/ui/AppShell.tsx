"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import IconButton from "./IconButton";
import { MenuIcon } from "./icons";
import Overlay from "./Overlay";

export interface AppShellProps {
  /** Logo and product name at the top of the sidebar. */
  brand: ReactNode;
  /** The navigation (links by role); shown in the sidebar, and in a drawer on phones. */
  nav: ReactNode;
  /** Pinned to the bottom of the sidebar (e.g. sign out). */
  navFooter?: ReactNode;
  /** Page title on the left of the top bar. */
  title?: ReactNode;
  /** Right side of the top bar: org switcher, bell, language, profile. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The frame of every signed-in page: a sidebar on tablet and desktop, a menu button and drawer on
 * phones, a top bar, and the scrolling page area.
 */
const AppShell = ({ brand, nav, navFooter, title, actions, children }: AppShellProps) => {
  const t = useTranslations("ui.shell");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // Close the phone menu after navigating.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  // Close it too if the window grows past the phone breakpoint (the sidebar is visible then).
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const onChange = () => query.matches && setMenuOpen(false);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const navBlock = (
    <nav aria-label={t("navigation")} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
      {navFooter ? <div className="shrink-0 border-t border-border py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{navFooter}</div> : null}
    </nav>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface px-3 md:flex">
        <div className="flex h-16 shrink-0 items-center px-2">{brand}</div>
        {navBlock}
      </aside>

      <Overlay
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={brand}
        placement="left"
        panelClassName="px-0"
      >
        <div className="-mx-2 flex h-full flex-col">{navBlock}</div>
      </Overlay>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <IconButton
            className="md:hidden"
            label={t("openMenu")}
            icon={<MenuIcon className="size-5" />}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          />
          <div className="min-w-0 flex-1 truncate text-body font-medium text-ink">{title}</div>
          {actions ? <div className="flex shrink-0 items-center gap-1 sm:gap-3">{actions}</div> : null}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
