export const getClassStudentDisplayName = (item: ClassStudent) => {
  const fullName = item.student?.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const contact = item.student?.email || item.student?.phone || item.invited_email || item.invited_phone;
  if (contact) {
    return contact;
  }

  if (item.student?.student_public_id) {
    return `Student ${item.student.student_public_id}`;
  }

  return "Invited student";
};

export const getClassStudentContact = (item: ClassStudent) =>
  item.student?.email || item.student?.phone || item.invited_email || item.invited_phone || "N/A";
