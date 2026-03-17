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
                    <StudentSVG />
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
                    <TestsTakenSVG />
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

const StudentSVG = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="16" height="16" rx="2" fill="#49734F" />
    <path
      d="M12.3175 7.50592C12.3995 7.46972 12.4692 7.41025 12.5178 7.33487C12.5663 7.25949 12.5917 7.17151 12.5908 7.08184C12.5899 6.99216 12.5627 6.90473 12.5125 6.83037C12.4624 6.75601 12.3916 6.69799 12.3088 6.6635L8.38042 4.87417C8.26099 4.81969 8.13126 4.7915 8 4.7915C7.86874 4.7915 7.73901 4.81969 7.61958 4.87417L3.69167 6.66167C3.61007 6.69741 3.54065 6.75615 3.49191 6.83071C3.44316 6.90527 3.41721 6.99242 3.41721 7.0815C3.41721 7.17058 3.44316 7.25773 3.49191 7.33229C3.54065 7.40686 3.61007 7.4656 3.69167 7.50133L7.61958 9.2925C7.73901 9.34697 7.86874 9.37516 8 9.37516C8.13126 9.37516 8.26099 9.34697 8.38042 9.2925L12.3175 7.50592Z"
      stroke="white"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12.5833 7.0835V9.8335" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M5.25 8.229V9.83317C5.25 10.1978 5.53973 10.5476 6.05546 10.8054C6.57118 11.0633 7.27065 11.2082 8 11.2082C8.72935 11.2082 9.42882 11.0633 9.94454 10.8054C10.4603 10.5476 10.75 10.1978 10.75 9.83317V8.229"
      stroke="white"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TestsTakenSVG = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="16" height="16" rx="2" fill="#ED8600" />
    <path
      d="M9.37501 3.4165H5.25001C5.0069 3.4165 4.77374 3.51308 4.60183 3.68499C4.42992 3.8569 4.33334 4.09006 4.33334 4.33317V11.6665C4.33334 11.9096 4.42992 12.1428 4.60183 12.3147C4.77374 12.4866 5.0069 12.5832 5.25001 12.5832H10.75C10.9931 12.5832 11.2263 12.4866 11.3982 12.3147C11.5701 12.1428 11.6667 11.9096 11.6667 11.6665V5.70817L9.37501 3.4165Z"
      stroke="white"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.91666 3.4165V5.24984C8.91666 5.49295 9.01323 5.72611 9.18514 5.89802C9.35705 6.06993 9.59021 6.1665 9.83332 6.1665H11.6667"
      stroke="white"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
