import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/lib/hooks";
import useGetAllClassById from "@/hooks/api/class/useGetAllClassById";
import useGetStudentClassById from "@/hooks/api/class/useGetStudentClassById";
import useGetAllTests from "@/hooks/api/tests/useGetAllTests";
import useGetStudentClassTests from "@/hooks/api/tests/useGetStudentClassTests";
import { setOpenShareClassModal } from "@/lib/features/classSlice";

export const classTabList = [
  { name: "Student", value: "student" },
  { name: "Tests", value: "tests" },
];

export default function useClassDetails(classId: string, role: RoleUserType | undefined) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT";

  if (!classId) {
    router.push("/classes");
  }

  const teacherClassDetails = useGetAllClassById({ id: classId, enabled: isTeacher });
  const studentClassDetails = useGetStudentClassById({ id: classId, enabled: isStudent });
  const { loading, classData, fetch, apiComplete } = isStudent ? studentClassDetails : teacherClassDetails;

  const teacherTests = useGetAllTests({ classId, enabled: isTeacher, role: "TEACHER" });
  const studentTests = useGetStudentClassTests({ classId, enabled: isStudent });
  const { testList } = isStudent ? studentTests : teacherTests;
  const [activeTab, setActiveTab] = useState(classTabList[0]);

  const handleShareClass = () => {
    if (classData) {
      dispatch(setOpenShareClassModal(classData));
    }
  };

  return {
    loading,
    classData,
    fetch,
    apiComplete,
    testList,
    activeTab,
    setActiveTab,
    handleShareClass,
  };
}
