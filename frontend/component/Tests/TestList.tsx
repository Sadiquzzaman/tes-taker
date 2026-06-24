"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useMemo } from "react";
import { setSearchInput } from "@/lib/features/testSlice";
import TestCard from "../Classes/TestCard";
import useGetAllTests from "@/hooks/api/tests/useGetAllTests";
import { RotatingLines } from "react-loader-spinner";
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

const TestList = ({ role }: TestListProps) => {
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

  if (loading)
    return (
      <div className="w-full min-h-[calc(100vh-300px)] flex items-center justify-center">
        <RotatingLines
          visible={true}
          height="48"
          width="48"
          color="grey"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="rotating-lines-loading"
          wrapperStyle={{}}
          wrapperClass=""
        />
      </div>
    );

  if (!apiComplete) return null;

  if (filteredTestList.length === 0) {
    return (
      <div className="w-full min-h-[calc(100vh-400px)] flex items-center justify-center">
        <div className="text-center">
          <p className="font-[600] text-[24px] leading-[32px] tracking-[-0.04em] text-[#232A25]">Test not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-4">
      {filteredTestList.length > 0 &&
        filteredTestList.map((test) => (
          <TestCard key={test.id} cardBackground="white" from="testList" testData={test} role={role} />
        ))}
    </div>
  );
};

export default TestList;
