const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\d+$/;
const csvIdentifierHeaders = ["email_or_phone", "email", "phone", "student", "student_email_or_phone"];

export const isValidStudentIdentifier = (input: string) => {
  const trimmed = input.trim();

  if (!trimmed) return false;

  if (trimmed.includes("@")) {
    return emailRegex.test(trimmed);
  }

  return phoneRegex.test(trimmed) && trimmed.length === 11;
};

export const normalizeStudentIdentifier = (input: string) => {
  const trimmed = input.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
};

export const getValidationError = (input: string) => {
  const trimmed = input.trim();

  if (!emailRegex.test(trimmed) && !phoneRegex.test(trimmed)) {
    return {
      title: "Invalid input",
      description: "Please enter a valid email address or phone number.",
    };
  }

  if (trimmed.includes("@") && !emailRegex.test(trimmed)) {
    return {
      title: "Invalid email",
      description: "Please enter a valid email address.",
    };
  }

  if (phoneRegex.test(trimmed) && trimmed.length !== 11) {
    return {
      title: "Invalid phone number",
      description: "Phone number must be 11 digits.",
    };
  }

  return null;
};

export const getInvalidStudentIndices = (items: string[]) =>
  items.reduce<number[]>((acc, student, index) => (isValidStudentIdentifier(student) ? acc : [...acc, index]), []);

export const getUniqueStudents = (items: string[], existingItems: string[] = []) => {
  const existingSet = new Set(existingItems.map((item) => normalizeStudentIdentifier(item)));
  const seenInBatch = new Set<string>();

  return items.filter((item) => {
    const normalized = normalizeStudentIdentifier(item);

    if (!normalized || existingSet.has(normalized) || seenInBatch.has(normalized)) {
      return false;
    }

    seenInBatch.add(normalized);
    return true;
  });
};

export const getEditedInvalidTagState = (items: string[], clickedIndex: number, currentValue: string) => {
  const clickedValue = items[clickedIndex];
  const currentDraft = currentValue.trim();
  const nextStudents = items.filter((_, index) => index !== clickedIndex);

  if (currentDraft !== "") {
    nextStudents.push(currentDraft);
  }

  return {
    nextStudents,
    nextValue: clickedValue,
  };
};

export const parseCsvText = (text: string) => {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows;
};

const getCsvIdentifierColumnIndex = (rows: string[][]) => {
  const headerRow = rows[0]?.map((item) => item.trim().toLowerCase()) || [];
  return headerRow.findIndex((item) => csvIdentifierHeaders.includes(item));
};

export const downloadStudentCsvTemplate = () => {
  const templateRows = [
    "email_or_phone",
    "01712345678",
    "student@example.com",
    "01798765432",
  ];

  const csvContent = templateRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "student-list-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const extractStudentsFromCsvRows = (rows: string[][]) => {
  const identifierColumnIndex = getCsvIdentifierColumnIndex(rows);

  return (identifierColumnIndex >= 0 ? rows.slice(1).map((row) => row[identifierColumnIndex] || "") : rows.flat())
    .map((item) => item.trim())
    .filter((item) => item !== "");
};
