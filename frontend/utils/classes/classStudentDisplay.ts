/** Words used when a student has no name yet (pass translated text). */
export type StudentNameFallbacks = { invited: string; withId: (id: string) => string };

const ENGLISH: StudentNameFallbacks = { invited: "Invited student", withId: (id) => `Student ${id}` };

export const getClassStudentDisplayName = (item: ClassStudent, fallbacks: StudentNameFallbacks = ENGLISH) => {
  const fullName = item.student?.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const contact = item.student?.email || item.student?.phone || item.invited_email || item.invited_phone;
  if (contact) {
    return contact;
  }

  if (item.student?.student_public_id) {
    return fallbacks.withId(item.student.student_public_id);
  }

  return fallbacks.invited;
};

export const getClassStudentContact = (item: ClassStudent) =>
  item.student?.email || item.student?.phone || item.invited_email || item.invited_phone || "—";
