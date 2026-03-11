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

const ClassList = () => {
  const { fetch, loading, classList } = useGetAllClass();
  const { searchInput } = useAppSelector((state) => state.class);
  const dispatch = useAppDispatch();

  const [filterdClassList, setFilterdClassList] = useState<Class[]>([]);

  useEffect(() => {
    if (classList.length > 0) {
      const filtered = classList.filter(
        (classItem) =>
          classItem.class_name.toLowerCase().includes(searchInput.toLowerCase()) ||
          classItem.description.toLowerCase().includes(searchInput.toLowerCase()),
      );
      setFilterdClassList(filtered);
    }
  }, [searchInput, classList]);

  useEffect(() => {
    dispatch(setSearchInput(""));
  }, [classList, loading]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
      {filterdClassList.map((classItem) => {
        return (
          <div key={classItem.id} className="h-[328px] bg-white rounded-[8px]">
            <div className="w-full h-[264px] p-4 flex flex-col justify-between">
              <div className="w-full h-[120px] relative">
                <Image
                  src="/assets/image/class_default.png"
                  alt="Class Image"
                  fill
                  className="w-full h-full object-cover rounded-[6px]"
                />
              </div>
              <p className="font-[600] text-[16px] leading-[20px] tracking-[-0.02em] text-[#232A25]">
                {classItem.class_name}
              </p>
              <div className="flex justify-between items-center">
                <div className="w-[45%]">
                  <p className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Student</p>
                  <p className="mt-2 ml-1 font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25]">
                    {classItem.classStudents.length}
                  </p>
                </div>
                <div className="w-[45%]">
                  <p className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Tests taken</p>
                  <p className="mt-2 ml-1 font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25]">
                    {classItem.total_test_taken}
                  </p>
                </div>
              </div>
              <p className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">
                Last quiz taken on -{" "}
                {classItem.last_test_taken_date ? new Date(classItem.last_test_taken_date).toLocaleString() : "N/A"}
              </p>
            </div>
            <div className="w-full h-[64px] flex items-center justify-between items-center p-4 border-t border-[#EFF0F3]">
              <div className="flex items-center gap-6 text-[#747775]">
                <button>
                  <HumanAddIconSVG width={16} />
                </button>
                <button>
                  <ShareIconSVG width={16} />
                </button>
                <button>
                  <ThreeDotIconSVG width={16} />
                </button>
              </div>
              <Link href={`/classes/details/${classItem.id}`}>
                <button className="h-8 rounded-[8px] px-3 bg-[#49734F] text-[#ffffff] font-[500] text-[12px] leading-[16px] tracking-[-0.02em]">
                  View Class
                </button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ClassList;
