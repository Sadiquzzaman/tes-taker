import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/lib/hooks";
import useGetAllClassById from "@/hooks/api/class/useGetAllClassById";
import useGetAllTests from "@/hooks/api/tests/useGetAllTests";
import { setOpenShareClassModal } from "@/lib/features/classSlice";

export const classTabList = [
  { name: "Student", value: "student" },
  { name: "Tests", value: "tests" },
];

export default function useClassDetails(classId: string) {
  const dispatch = useAppDispatch();
  const router = useRouter();

  if (!classId) {
    router.push("/classes");
  }

  const { loading, classData, fetch, apiComplete } = useGetAllClassById({ id: classId });
  const { testList } = useGetAllTests({ classId });
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
