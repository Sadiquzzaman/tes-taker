"use client";

import useStudentClassList from "@/hooks/classes/useStudentClassList";
import StudentClassCard from "./StudentClassCard";

const StudentClassList = () => {
  const { filteredClassList } = useStudentClassList();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4">
      {filteredClassList.map((classItem, index) => (
        <StudentClassCard key={classItem.id} classItem={classItem} index={index} />
      ))}
    </div>
  );
};

export default StudentClassList;
