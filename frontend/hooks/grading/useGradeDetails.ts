"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { classTabList, studentList } from "@/utils/grading/gradeDetails";

const itemsPerPage = 6;

const useGradeDetails = (classId: string) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(classTabList[0]);
  const [openModal, setOpenModal] = useState<GradingModalView>("");
  const [searchStudentInput, setSearchStudentInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!classId) {
      router.push("/classes");
    }
  }, [classId, router]);

  const filteredStudents = useMemo(() => {
    const searchValue = searchStudentInput.trim().toLowerCase();

    if (!searchValue) {
      return studentList;
    }

    return studentList.filter((student) => {
      return student.name.toLowerCase().includes(searchValue) || student.email.toLowerCase().includes(searchValue);
    });
  }, [searchStudentInput]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const remainingStudents = Math.max(0, filteredStudents.length - currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchStudentInput]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return {
    activeTab,
    setActiveTab,
    openModal,
    setOpenModal,
    searchStudentInput,
    setSearchStudentInput,
    currentPage,
    handlePageChange,
    paginatedStudents,
    totalPages,
    remainingStudents,
  };
};

export default useGradeDetails;
