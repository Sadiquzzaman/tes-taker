"use client";

import useGetGradeDetails from "@/hooks/api/grading/useGetGradeDetails";
import GradingModel from "./GradingModel";
import GradeDetailsHeader from "./GradeDetailsHeader";
import GradeDetailsStats from "./GradeDetailsStats";
import StudentSubmissionsTable from "./StudentSubmissionsTable";
import { RotatingLines } from "react-loader-spinner";

const GradeDetailsComponent = ({ classId }: { classId: string }) => {
  const { apiComplete, loading } = useGetGradeDetails(classId);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-300px)] w-full items-center justify-center">
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
  }

  if (!apiComplete) {
    return null;
  }

  return (
    <>
      <div className="mb-2 flex min-h-[40px] flex-col gap-2 sm:mt-2 sm:mb-4 sm:gap-4">
        <GradeDetailsHeader />
        <GradeDetailsStats />
      </div>

      <div className="flex min-h-[calc(100vh-320px)] flex-col gap-6 rounded-[12px] bg-[#EFF0F3BF] p-2 sm:p-4">
        <StudentSubmissionsTable />
        <GradingModel />
      </div>
    </>
  );
};

export default GradeDetailsComponent;
