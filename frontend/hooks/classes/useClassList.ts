import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setSearchInput } from "@/lib/features/classSlice";
import useGetAllClass from "@/hooks/api/class/useGetAllClass";

export default function useClassList() {
  const { fetch, loading, classList, apiComplete } = useGetAllClass();
  const { searchInput } = useAppSelector((state) => state.class);
  const dispatch = useAppDispatch();

  const [filteredClassList, setFilteredClassList] = useState<Class[]>([]);

  useEffect(() => {
    if (classList.length > 0) {
      const filtered = classList.filter(
        (classItem) =>
          classItem.class_name.toLowerCase().includes(searchInput.toLowerCase()) ||
          classItem.description.toLowerCase().includes(searchInput.toLowerCase()),
      );
      setFilteredClassList(filtered);
    } else {
      setFilteredClassList([]);
    }
  }, [searchInput, classList]);

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
