"use client";

import { useTranslations } from "next-intl";
import { FilterBar, PageHeader, Select } from "@/design/ui";
import { setActiveTab, setSearchInput } from "@/lib/features/gradingSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { gradingTabList } from "@/utils/gradingTabList";

/** The Grading page header: search and the grading-status filter. */
const GradingNameSection = () => {
  const t = useTranslations("grading");
  const { activeTab, searchInput } = useAppSelector((state) => state.grade);
  const dispatch = useAppDispatch();

  return (
    <div className="mb-6 flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("intro")} />
      <FilterBar
        search={searchInput}
        onSearchChange={(value) => dispatch(setSearchInput(value))}
        searchPlaceholder={t("search")}
        hasActiveFilters={Boolean(searchInput) || activeTab.value !== "ALL"}
        onClear={() => {
          dispatch(setSearchInput(""));
          dispatch(setActiveTab(gradingTabList[0]));
        }}
      >
        <Select
          label={t("filter.ALL")}
          hideLabel
          placeholder={false}
          value={activeTab.value}
          onChange={(event) => dispatch(setActiveTab(gradingTabList.find((tab) => tab.value === event.target.value) ?? gradingTabList[0]))}
          options={gradingTabList.map((tab) => ({ value: tab.value, label: t(`filter.${tab.value}`) }))}
          fieldClassName="sm:w-48"
        />
      </FilterBar>
    </div>
  );
};

export default GradingNameSection;
