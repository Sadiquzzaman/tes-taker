"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChevronDownIcon, cn, focusRing } from "@/design/ui";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import { useStorageItem } from "@/hooks/useBrowserStorage";
import { NAV_OPEN_GROUPS_KEY, navEntries } from "@/utils/sidebarGroups";

const linkClasses = (active: boolean) =>
  cn(
    "flex items-center gap-2.5 rounded-input px-3 py-2 text-body-sm font-medium transition-colors duration-(--motion-fast)",
    active ? "bg-primary text-ink-inverse" : "text-ink hover:bg-primary-soft hover:text-primary",
    focusRing,
  );

const readOpenGroups = (stored: string | null | undefined): Partial<Record<NavGroup, boolean>> => {
  if (!stored) return {};
  try {
    return JSON.parse(stored) as Partial<Record<NavGroup, boolean>>;
  } catch {
    return {};
  }
};

/**
 * The menu links of one sidebar section, with related pages folded into groups (Attendance,
 * People, …). The group holding the current page starts open, the others closed; what a viewer
 * opens or closes is remembered in this browser. Items whose plan feature is off are left out, as
 * FeatureNavGate does, and a group with nothing left is not shown.
 */
const SidebarNav = ({ items, activeRoute }: { items: SideBarList[]; activeRoute: string }) => {
  const t = useTranslations("nav");
  const { entitlements, loading } = useEntitlements();
  const stored = useStorageItem("local", NAV_OPEN_GROUPS_KEY);
  // Toggles made on this page; they win over what was stored, which wins over the default.
  const [toggled, setToggled] = useState<Partial<Record<NavGroup, boolean>>>({});

  const featureOn = (feature: string | string[]) => (Array.isArray(feature) ? feature : [feature]).some((key) => entitlements?.features?.[key]);
  // Known entitlements (this load's, or the last ones remembered while loading) decide; unknown ones
  // hide gated items while loading and show them if loading failed (the server still refuses).
  const visible = items.filter((item) => !item.feature || (entitlements ? featureOn(item.feature) : !loading));
  const entries = navEntries(visible);
  const remembered = readOpenGroups(stored);

  const isOpen = (group: NavGroup, groupItems: SideBarList[]) =>
    toggled[group] ?? remembered[group] ?? groupItems.some((item) => item.route === activeRoute);

  const toggle = (group: NavGroup, open: boolean) => {
    setToggled((current) => ({ ...current, [group]: open }));
    try {
      localStorage.setItem(NAV_OPEN_GROUPS_KEY, JSON.stringify({ ...remembered, ...toggled, [group]: open }));
    } catch {
      // Private windows may refuse storage; the menu still folds for this page.
    }
  };

  const link = (item: SideBarList, nested = false) => {
    const active = activeRoute === item.route;
    return (
      <li key={item.route}>
        <Link href={item.route} aria-current={active ? "page" : undefined} className={cn(linkClasses(active), nested && "pl-9")}>
          {nested ? null : item.image}
          {t(item.label)}
        </Link>
      </li>
    );
  };

  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map((entry) => {
        if (entry.kind === "link") return link(entry.item);
        const open = isOpen(entry.group, entry.items);
        const holdsCurrent = entry.items.some((item) => item.route === activeRoute);
        const listId = `nav-group-${entry.group}`;
        const firstSetup = entry.items.findIndex((item) => item.setup);
        return (
          <li key={entry.group}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggle(entry.group, !open)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-input px-3 py-2 text-left text-body-sm font-medium transition-colors duration-(--motion-fast)",
                holdsCurrent && !open ? "text-primary" : "text-ink",
                "hover:bg-primary-soft hover:text-primary",
                focusRing,
              )}
            >
              {entry.items[0].image}
              <span className="flex-1">{t(`group.${entry.group}`)}</span>
              <ChevronDownIcon className={cn("shrink-0 transition-transform duration-(--motion-fast)", open ? "rotate-180" : "")} />
            </button>
            <ul id={listId} hidden={!open} className="mt-0.5 flex flex-col gap-0.5">
              {entry.items.map((item, index) => (
                <FragmentWithSetup key={item.route} heading={index === firstSetup && index > 0 ? t("group.setup") : null}>
                  {link(item, true)}
                </FragmentWithSetup>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
};

/** An item, with the small "Setup" heading before the first setup page of a group. */
const FragmentWithSetup = ({ heading, children }: { heading: string | null; children: React.ReactNode }) => (
  <>
    {heading ? (
      <li role="presentation" className="px-3 pb-0.5 pl-9 pt-2 text-caption font-medium uppercase tracking-wide text-ink-muted">
        {heading}
      </li>
    ) : null}
    {children}
  </>
);

export default SidebarNav;
