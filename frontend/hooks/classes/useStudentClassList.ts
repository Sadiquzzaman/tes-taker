import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setSearchInput } from "@/lib/features/classSlice";
import useGetStudentClassList from "@/hooks/api/class/useGetStudentClassList";

export default function useStudentClassList() {
  const { fetch, loading, classList, apiComplete } = useGetStudentClassList();
  const { searchInput } = useAppSelector((state) => state.class);
  const dispatch = useAppDispatch();

  const normalizedSearchInput = searchInput.toLowerCase();

  const filteredClassList = classList.filter(
    (classItem) =>
      classItem.class_name.toLowerCase().includes(normalizedSearchInput) ||
      classItem.description.toLowerCase().includes(normalizedSearchInput) ||
      classItem.created_user_name.toLowerCase().includes(normalizedSearchInput),
  );

  useEffect(() => {
    dispatch(setSearchInput(""));
  }, [classList, loading, dispatch]);

  return {
    fetch,
    loading,
    filteredClassList,
    apiComplete,
    dispatch,
  };
}
