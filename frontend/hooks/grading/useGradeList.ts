"use client";

import { useEffect, useMemo } from "react";
import useGetAllClass from "@/hooks/api/class/useGetAllClass";
import { setSearchInput } from "@/lib/features/classSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

const useGradeList = () => {
  const { apiComplete, classList, loading } = useGetAllClass();
  const { searchInput } = useAppSelector((state) => state.class);
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setSearchInput(""));
  }, [dispatch]);

  const filteredClassList = useMemo(() => {
    const searchValue = searchInput.toLowerCase();

    return classList.filter((classItem) => {
      return (
        classItem.class_name.toLowerCase().includes(searchValue) ||
        classItem.description.toLowerCase().includes(searchValue)
      );
    });
  }, [classList, searchInput]);

  return {
    apiComplete,
    filteredClassList,
    loading,
  };
};

export default useGradeList;
