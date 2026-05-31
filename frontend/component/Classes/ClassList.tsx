"use client";

import StudentClassList from "./StudentClassList";
import TeacherClassList from "./TeacherClassList";

const ClassList = ({ role }: ClassListProps) => {
  return role === "TEACHER" ? <TeacherClassList /> : <StudentClassList />;
};

export default ClassList;
