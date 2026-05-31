"use client";

import useClassList from "@/hooks/classes/useClassList";
import AddStudentModal from "./AddStudentModal";
import ClassCard from "./ClassCard";
import ShareClassModal from "./ShareClassModal";

const TeacherClassList = () => {
  const { fetch, filteredClassList } = useClassList();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4">
      {filteredClassList.map((classItem, index) => (
        <ClassCard key={classItem.id} classItem={classItem} index={index} />
      ))}
      <AddStudentModal fetchClassDetails={fetch} />
      <ShareClassModal />
    </div>
  );
};

export default TeacherClassList;
