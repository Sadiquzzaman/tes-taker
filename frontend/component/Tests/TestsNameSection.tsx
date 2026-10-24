"use client";

import { useTranslations } from "next-intl";
import CreateTestActionButton from "@/component/Tests/CreateTestActionButton";
import { FilterBar, PageHeader, Select } from "@/design/ui";
import { setActiveTab, setNewTestCreated, setSearchInput } from "@/lib/features/testSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { testsTabList } from "@/utils/testsTabList";
import ShareTestModal from "./ShareTestModal";

/** The Tests page header: Create test (teachers), search and the status filter. */
const TestsNameSection = ({ role }: { role: RoleUserType | undefined }) => {
  const t = useTranslations("tests");
  const { activeTab, searchInput, newTestCreated } = useAppSelector((state) => state.test);
  const dispatch = useAppDispatch();
  const isTeacher = role === "TEACHER";

  return (
    <div className="mb-6 flex flex-col gap-4">
      <PageHeader title={t("title")} description={isTeacher ? t("intro") : t("studentIntro")} actions={isTeacher ? <CreateTestActionButton /> : undefined} />
      <FilterBar
        search={searchInput}
        onSearchChange={(value) => dispatch(setSearchInput(value))}
        searchPlaceholder={t("search")}
        hasActiveFilters={Boolean(searchInput) || activeTab.value !== "all"}
        onClear={() => {
          dispatch(setSearchInput(""));
          dispatch(setActiveTab(testsTabList[0]));
        }}
      >
        <Select
          label={t("filter.all")}
          hideLabel
          placeholder={false}
          value={activeTab.value}
          onChange={(event) => dispatch(setActiveTab(testsTabList.find((tab) => tab.value === event.target.value) ?? testsTabList[0]))}
          options={testsTabList.map((tab) => ({ value: tab.value, label: t(`filter.${tab.value}`) }))}
          fieldClassName="sm:w-44"
        />
      </FilterBar>
      {newTestCreated ? (
        <ShareTestModal open={newTestCreated !== null} setOpen={() => dispatch(setNewTestCreated(null))} testData={newTestCreated} />
      ) : null}
    </div>
  );
};

export default TestsNameSection;
