"use client";

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  key: string;
  label: ReactNode;
  /** A count or badge after the label. */
  badge?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled: the selected tab's key. Leave out to let the tabs manage it. */
  selectedKey?: string;
  onChange?: (key: string) => void;
  defaultKey?: string;
  className?: string;
}

/** Tabs for the sections of a detail page. Arrow keys move between tabs; the list scrolls sideways on phones. */
const Tabs = ({ tabs, selectedKey, onChange, defaultKey, className }: TabsProps) => {
  const indexOf = (key?: string) => Math.max(0, tabs.findIndex((tab) => tab.key === key));

  return (
    <TabGroup
      className={cn("flex flex-col gap-4", className)}
      selectedIndex={selectedKey !== undefined ? indexOf(selectedKey) : undefined}
      defaultIndex={defaultKey !== undefined ? indexOf(defaultKey) : undefined}
      onChange={(index) => onChange?.(tabs[index].key)}
    >
      <TabList className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border px-1">
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            disabled={tab.disabled}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-body-sm font-medium text-ink-muted",
              "transition-colors duration-(--motion-fast) outline-none hover:text-ink",
              "data-selected:border-primary data-selected:text-primary",
              "data-focus:rounded-t-input data-focus:ring-2 data-focus:ring-primary",
              "data-disabled:cursor-not-allowed data-disabled:opacity-50",
            )}
          >
            {tab.label}
            {tab.badge}
          </Tab>
        ))}
      </TabList>
      <TabPanels>
        {tabs.map((tab) => (
          <TabPanel key={tab.key} className="outline-none">
            {tab.content}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
};

export default Tabs;
