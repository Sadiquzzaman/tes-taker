"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useMemo } from "react";
import { setSearchInput } from "@/lib/features/testSlice";
import TestCard from "../Classes/TestCard";
import useGetAllTests from "@/hooks/api/tests/useGetAllTests";
import { useTranslations } from "next-intl";
import { Card, EmptyState, Skeleton } from "@/design/ui";
import CreateTestActionButton from "./CreateTestActionButton";
import { getTestAudienceLabel, getTestSubjectLabel } from "@/utils/tests/testListItem";

interface TestListProps {
  role: RoleUserType | undefined;
}

const matchesStartsWith = (value: string, searchValue: string) => {
  const normalizedValue = value.trim().toLowerCase();

  if (!searchValue) {
    return true;
  }

  return (
    normalizedValue.startsWith(searchValue) || normalizedValue.split(/\s+/).some((word) => word.startsWith(searchValue))
  );
};

/** The tests, filtered by the search box and status filter above. */
const TestList = ({ role }: TestListProps) => {
  const t = useTranslations("tests");
  const { loading, testList, apiComplete } = useGetAllTests({ role });
  const { activeTab, searchInput } = useAppSelector((state) => state.test);
  const dispatch = useAppDispatch();
  const normalizedSearchInput = searchInput.trim().toLowerCase();

  const filteredTestList = useMemo(
    () =>
      testList.filter((testItem) => {
        const matchesSearch =
          matchesStartsWith(getTestSubjectLabel(testItem), normalizedSearchInput) ||
          matchesStartsWith(getTestAudienceLabel(testItem), normalizedSearchInput) ||
          matchesStartsWith(testItem.test_name, normalizedSearchInput);

        if (!matchesSearch) {
          return false;
        }

        if (activeTab.value === "all") {
          return true;
        }

        return testItem.status === activeTab.value;
      }),
    [activeTab.value, normalizedSearchInput, testList],
  );

  useEffect(() => {
    dispatch(setSearchInput(""));
  }, [dispatch]);

  if (loading || !apiComplete) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-card border border-border bg-surface p-4">
            <Skeleton lines={5} />
          </div>
        ))}
      </div>
    );
  }

  if (filteredTestList.length === 0) {
    const filtering = Boolean(normalizedSearchInput) || activeTab.value !== "all";
    return (
      <Card>
        <EmptyState
          title={filtering ? t("noMatch") : t("empty")}
          description={filtering ? undefined : role === "TEACHER" ? t("emptyTeacher") : t("emptyStudent")}
          action={!filtering && role === "TEACHER" ? <CreateTestActionButton /> : undefined}
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {filteredTestList.map((test) => (
        <TestCard key={test.id} from="testList" testData={test} role={role} />
      ))}
    </div>
  );
};

export default TestList;
