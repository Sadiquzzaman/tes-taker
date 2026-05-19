"use client";

import useGetAllClass from "@/hooks/api/class/useGetAllClass";
import Image from "next/image";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import ShareIconSVG from "../svg/ShareIconSVG";
import ThreeDotIconSVG from "../svg/ThreeDotIconSVG";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useState } from "react";
import { setOpenAddStudentModal, setSearchInput, setOpenShareClassModal } from "@/lib/features/classSlice";
import Link from "next/link";
import ShareClassModal from "./ShareClassModal";
import AddStudentModal from "./AddStudentModal";
import { RotatingLines } from "react-loader-spinner";
import ClassStudentCardIconSVG from "../svg/ClassStudentCardIconSVG";
import ClassTestsTakenIconSVG from "../svg/ClassTestsTakenIconSVG";

const ImageList = [
  "/assets/image/classImage/class_default.png",
  "/assets/image/classImage/class_default_2.png",
  "/assets/image/classImage/class_default_3.png",
  "/assets/image/classImage/class_default_4.png",
  "/assets/image/classImage/class_default_5.png",
];
const ClassList = () => {
  const { fetch, loading, classList, apiComplete } = useGetAllClass();
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4">
      {filterdClassList.map((classItem, index) => {
        return (
          <div key={classItem.id} className="h-[328px] bg-white rounded-[8px]">
            <div className="w-full h-[264px] p-4 flex flex-col justify-between">
              <div className="w-full h-[120px] relative">
                <Image
                  src={ImageList[index % ImageList.length]}
                  alt="Class Image"
                  fill
                  className="w-full h-full object-cover rounded-[6px]"
                />
              </div>
              <p className="pt-2 font-[500] text-[16px] leading-[20px] tracking-[-0.02em] text-[#232A25]">
                {classItem.class_name}
              </p>
              <p className="pb-3 font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">
                Last quiz taken on -{" "}
                {classItem.last_test_taken_date ? new Date(classItem.last_test_taken_date).toLocaleString() : "N/A"}
              </p>
              <div className="flex justify-between items-center">
                <div className="w-[45%] flex gap-1">
                  <div>
                    <ClassStudentCardIconSVG width={16} />
                  </div>
                  <div>
                    <p className="font-[400] text-[12px] leading-[16px] tracking-[-0.01em] text-[#232A25]">Student</p>
                    <p className="mt-2 ml-1 font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25]">
                      {classItem.classStudents.length}
                    </p>
                  </div>
                </div>
                <div className="w-[45%] flex gap-1">
                  <div>
                    <ClassTestsTakenIconSVG width={16} />
                  </div>
                  <div>
                    <p className="font-[400] text-[12px] leading-[16px] tracking-[-0.01em] text-[#232A25]">
                      Tests taken
                    </p>
                    <p className="mt-2 ml-1 font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25]">
                      {classItem.total_test_taken}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full h-[64px] flex items-center justify-between items-center p-4 border-t border-[#EFF0F3]">
              <div className="flex items-center gap-2 text-[#747775]">
                <button
                  title="Add Students"
                  className="w-8 h-8 flex justify-center items-center rounded-[8px] hover:bg-[#EFF0F3]"
                  onClick={() => dispatch(setOpenAddStudentModal(classItem))}
                >
                  <HumanAddIconSVG width={16} />
                </button>
                <button
                  title="Share Class"
                  className="w-8 h-8 flex justify-center items-center rounded-[8px] hover:bg-[#EFF0F3]"
                  onClick={() => dispatch(setOpenShareClassModal(classItem))}
                >
                  <ShareIconSVG width={16} />
                </button>
                <button className="w-8 h-8 flex justify-center items-center rounded-[8px] hover:bg-[#EFF0F3]">
                  <ThreeDotIconSVG width={16} />
                </button>
              </div>
              <Link href={`/classes/details/${classItem.id}`}>
                <button className="h-8 rounded-[8px] px-3 bg-white text-[#49734F] border border-[#49734F] hover:bg-[#49734F] hover:text-white focus:bg-[#49734F] focus:text-white font-[500] text-[12px] leading-[16px] tracking-[-0.02em] transition-colors">
                  {" "}
                  View Class
                </button>
              </Link>
            </div>
          </div>
        );
      })}
      <AddStudentModal fetchClassDetails={fetch} />
      <ShareClassModal />
    </div>
  );
};

export default ClassList;
