import { useState, useEffect, useRef } from "react";
import { sampleClassList, sampleStudentList } from "@/utils/Dashboard/topStudents";

export const useTopStudents = () => {
  const [open, setOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassListItem>(sampleClassList[0]);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset search when class changes
  useEffect(() => {
    setSearch("");
  }, [selectedClass]);

  // Filter and sort students
  const filteredStudents = sampleStudentList
    .filter((student) => {
      return student.name.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const aScore = parseFloat(a.avgScore);
      const bScore = parseFloat(b.avgScore);
      if (sortOrder === "desc") {
        return bScore - aScore;
      } else {
        return aScore - bScore;
      }
    });

  const rowPerTable = 10;
  const remainingStudents = filteredStudents.length - rowPerTable;

  return {
    open,
    setOpen,
    selectedClass,
    setSelectedClass,
    search,
    setSearch,
    sortOrder,
    setSortOrder,
    dropdownRef,
    filteredStudents,
    rowPerTable,
    remainingStudents,
  };
};
