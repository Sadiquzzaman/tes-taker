import { useState, useEffect } from "react";
import useRemoveStudentFromClass from "@/hooks/api/class/useRemoveStudentFromClass";
import useApproveStudent from "@/hooks/api/class/useApproveStudent";

export default function useClassStudent({
  student,
  classId,
  fetch,
}: {
  student: ClassStudent[];
  classId: string;
  fetch: () => void;
}) {
  const [searchStudentInput, setSearchStudentInput] = useState("");
  const [filteredStudent, setFilteredStudent] = useState<{ pending: ClassStudent[]; active: ClassStudent[] }>({
    pending: [],
    active: [],
  });

  useEffect(() => {
    if (student.length > 0 && searchStudentInput.trim() === "") {
      setFilteredStudent({
        pending: student.filter((item) => item.status === "PENDING"),
        active: student.filter((item) => item.status !== "PENDING").sort((a, b) => (a.status === "JOINED" ? 0 : 1)),
      });
    } else if (student.length > 0 && searchStudentInput.trim() !== "") {
      const searchTerm = searchStudentInput.toLowerCase();
      const filtered = student.filter((item) => {
        const fullName = item.student?.full_name?.toLowerCase() || "";
        const email = item.student?.email || item.invited_email || "";
        const phone = item.student?.phone || item.invited_phone || "";

        return fullName.includes(searchTerm) || email.toLowerCase().includes(searchTerm) || phone.includes(searchTerm);
      });
      setFilteredStudent({
        pending: filtered.filter((item) => item.status === "PENDING"),
        active: filtered.filter((item) => item.status !== "PENDING").sort((a, b) => (a.status === "JOINED" ? -1 : 1)),
      });
    } else {
      setFilteredStudent({
        pending: [],
        active: [],
      });
    }
  }, [student, searchStudentInput]);

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
