"use client";

import GradingModel from "./GradingModel";
import GradeDetailsHeader from "./GradeDetailsHeader";
import GradeDetailsStats from "./GradeDetailsStats";
import StudentSubmissionsTable from "./StudentSubmissionsTable";
import useGradeDetails from "@/hooks/grading/useGradeDetails";
import { studentList } from "@/utils/grading/gradeDetails";

const GradeDetailsComponent = ({ classId }: { classId: string }) => {
  const {
    currentPage,
    handlePageChange,
    openModal,
    paginatedStudents,
    searchStudentInput,
    setOpenModal,
    setSearchStudentInput,
    totalPages,
  } = useGradeDetails(classId);

  const gradedCount = studentList.filter((student) => student.status === "Graded").length;
  const pendingCount = studentList.filter((student) => student.status === "Pending").length;

  return (
    <>
      <div className="mb-2 flex min-h-[40px] flex-col gap-2 sm:mt-2 sm:mb-4 sm:gap-4">
        <GradeDetailsHeader title="Grade Name" />
        <GradeDetailsStats
          totalStudents={studentList.length}
          submissions={studentList.length}
          pendingCount={pendingCount}
          gradedCount={gradedCount}
        />
      </div>

      <div className="flex min-h-[calc(100vh-320px)] flex-col gap-6 rounded-[12px] bg-[#EFF0F3BF] p-2 sm:p-4">
        <StudentSubmissionsTable
          currentPage={currentPage}
          onPageChange={handlePageChange}
          openStudentModal={setOpenModal}
          paginatedStudents={paginatedStudents}
          searchStudentInput={searchStudentInput}
          setSearchStudentInput={setSearchStudentInput}
          totalPages={totalPages}
        />
        <GradingModel openModal={openModal} setOpenModal={setOpenModal} />
      </div>
    </>
  );
};

export default GradeDetailsComponent;
