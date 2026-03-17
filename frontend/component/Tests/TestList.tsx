"use client";

import useGetAllClass from "@/hooks/api/class/useGetAllClass";
import Image from "next/image";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import ShareIconSVG from "../svg/ShareIconSVG";
import ThreeDotIconSVG from "../svg/ThreeDotIconSVG";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useState } from "react";
import { setSearchInput } from "@/lib/features/classSlice";
import Link from "next/link";
import TestCard from "../Classes/TestCard";
import useGetAllTests from "@/hooks/api/tests/useGetAllTests";
import { RotatingLines } from "react-loader-spinner";

const TestList = () => {
  const { fetch, loading, testList, apiComplete } = useGetAllTests({});
  const { searchInput } = useAppSelector((state) => state.test);
  const dispatch = useAppDispatch();

  const [filterdTestList, setFilterdTestList] = useState<Test[]>([]);

  useEffect(() => {
    if (testList.length > 0) {
      const filtered = testList.filter(
        (testItem) =>
          testItem.subject.toLowerCase().includes(searchInput.toLowerCase()) ||
          testItem.class.class_name.toLowerCase().includes(searchInput.toLowerCase()),
        // test name should added
      );
      setFilterdTestList(filtered);
    }
  }, [searchInput, testList]);

  useEffect(() => {
    dispatch(setSearchInput(""));
  }, [testList, loading]);

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

  if (filterdTestList.length === 0) {
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
      {filterdTestList.length > 0 &&
        filterdTestList.map((test) => (
          <TestCard key={test.id} cardBackground="white" from="testList" testData={test} />
        ))}
    </div>
  );
};

export default TestList;
