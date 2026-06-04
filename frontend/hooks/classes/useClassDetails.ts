import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/lib/hooks";
import useGetAllClassById from "@/hooks/api/class/useGetAllClassById";
import useGetStudentClassById from "@/hooks/api/class/useGetStudentClassById";
import useGetAllTests from "@/hooks/api/tests/useGetAllTests";
import { setOpenShareClassModal } from "@/lib/features/classSlice";

export const classTabList = [
  { name: "Student", value: "student" },
  { name: "Tests", value: "tests" },
];

export default function useClassDetails(classId: string, role: RoleUserType | undefined) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isTeacher = role === "TEACHER";

  if (!classId) {
    router.push("/classes");
  }

  const teacherClassDetails = useGetAllClassById({ id: classId, enabled: isTeacher });
  const studentClassDetails = useGetStudentClassById({ id: classId, enabled: !isTeacher });
  const { loading, classData, fetch, apiComplete } = isTeacher ? teacherClassDetails : studentClassDetails;

  const { testList } = useGetAllTests({ classId, enabled: isTeacher });
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
