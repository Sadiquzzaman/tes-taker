import { useMemo, useState } from "react";
import useRemoveStudentFromClass from "@/hooks/api/class/useRemoveStudentFromClass";
import useApproveStudent from "@/hooks/api/class/useApproveStudent";

const isTeacherStudent = (item: ClassDetailsStudentItem): item is ClassStudent => "student_id" in item;

const isStudentClassmate = (item: ClassDetailsStudentItem): item is StudentClassmate => "name" in item;

const sortTeacherStudents = (firstItem: ClassStudent, secondItem: ClassStudent) => {
  if (firstItem.status === secondItem.status) {
    return 0;
  }

  return firstItem.status === "JOINED" ? -1 : 1;
};

export default function useClassStudent({
  student,
  classId,
  fetch,
  role,
}: {
  student: ClassDetailsStudentItem[];
  classId: string;
  fetch: () => void;
  role: RoleUserType | undefined;
}) {
  const [searchStudentInput, setSearchStudentInput] = useState("");

  const filteredStudent = useMemo<{
    pending: ClassStudent[];
    activeStudents: ClassStudent[];
    classmates: StudentClassmate[];
  }>(() => {
    if (role === "TEACHER" && student.length > 0 && searchStudentInput.trim() === "") {
      const teacherStudents = student.filter(isTeacherStudent);

      return {
        pending: teacherStudents.filter((item) => item.status === "PENDING"),
        activeStudents: teacherStudents.filter((item) => item.status !== "PENDING").sort(sortTeacherStudents),
        classmates: [],
      };
    }

    if (role === "TEACHER" && student.length > 0 && searchStudentInput.trim() !== "") {
      const teacherStudents = student.filter(isTeacherStudent);
      const searchTerm = searchStudentInput.toLowerCase();
      const filtered = teacherStudents.filter((item) => {
        const fullName = item.student?.full_name?.toLowerCase() || "";
        const email = item.student?.email || item.invited_email || "";
        const phone = item.student?.phone || item.invited_phone || "";

        return fullName.includes(searchTerm) || email.toLowerCase().includes(searchTerm) || phone.includes(searchTerm);
      });

      return {
        pending: filtered.filter((item) => item.status === "PENDING"),
        activeStudents: filtered.filter((item) => item.status !== "PENDING").sort(sortTeacherStudents),
        classmates: [],
      };
    }

    if (role === "STUDENT" && student.length > 0) {
      const classmateList = student.filter(isStudentClassmate);
      const searchTerm = searchStudentInput.trim().toLowerCase();
      const filteredClassmates =
        searchTerm === ""
          ? classmateList
          : classmateList.filter((item) => item.name.toLowerCase().includes(searchTerm));

      return {
        pending: [],
        activeStudents: [],
        classmates: filteredClassmates,
      };
    }

    return {
      pending: [],
      activeStudents: [],
      classmates: [],
    };
  }, [role, searchStudentInput, student]);

  const [removeStudentFromClass] = useRemoveStudentFromClass({ classId });
  const [approveStudent] = useApproveStudent({ classId });

  const handleRemoveStudent = (studentId: string) => {
    removeStudentFromClass({ student_ids: [studentId] }).then((res) => {
      if (res?.statusCode === 200) fetch();
    });
  };

  const handleApproveStudent = (studentId: string) => {
    approveStudent(studentId).then((res) => {
      if (res?.statusCode === 201) fetch();
    });
  };

  return {
    searchStudentInput,
    setSearchStudentInput,
    filteredStudent,
    handleRemoveStudent,
    handleApproveStudent,
  };
}
