"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useMemo } from "react";
import { setSearchInput } from "@/lib/features/testSlice";
import TestCard from "../Classes/TestCard";
import useGetAllTests from "@/hooks/api/tests/useGetAllTests";
import { RotatingLines } from "react-loader-spinner";

const matchesStartsWith = (value: string, searchValue: string) => {
  const normalizedValue = value.trim().toLowerCase();

  if (!searchValue) {
    return true;
  }

  return (
    normalizedValue.startsWith(searchValue) || normalizedValue.split(/\s+/).some((word) => word.startsWith(searchValue))
  );
};

const TestList = () => {
  const { loading, testList, apiComplete } = useGetAllTests({});
  const { searchInput } = useAppSelector((state) => state.test);
  const dispatch = useAppDispatch();
  const normalizedSearchInput = searchInput.trim().toLowerCase();

  const filteredTestList = useMemo(
    () =>
      testList.filter(
        (testItem) =>
          testItem.subjects.some((subject) => matchesStartsWith(subject.name, normalizedSearchInput)) ||
          matchesStartsWith(testItem.class.class_name, normalizedSearchInput) ||
          matchesStartsWith(testItem.test_name, normalizedSearchInput),
      ),
    [normalizedSearchInput, testList],
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
      <div className="w-full min-h-[calc(100vh-162px)] flex items-center justify-center">
        <div className="text-center">
          <p className="font-[600] text-[24px] leading-[32px] tracking-[-0.04em] text-[#232A25]">Class not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-4">
      {filteredTestList.length > 0 &&
        filteredTestList.map((test) => (
          <TestCard key={test.id} cardBackground="white" from="testList" testData={test} />
        ))}
    </div>
  );
};

export default TestList;
