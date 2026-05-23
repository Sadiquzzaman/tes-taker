"use client";

import GradeCard from "./GradeCard";
import useGradeList from "@/hooks/grading/useGradeList";

const GradeList = () => {
  const { filteredClassList } = useGradeList();

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
      {filteredClassList.map((classItem) => (
        <GradeCard key={classItem.id} classItem={classItem} />
      ))}
    </div>
  );
};

export default GradeList;
