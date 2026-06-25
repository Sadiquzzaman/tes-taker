import { useState, useRef, useMemo, useEffect, ChangeEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setOpenAddStudentModal } from "@/lib/features/classSlice";
import useAddStudentInClass from "@/hooks/api/class/useAddStudentInClass";
import { useToast } from "@/component/Toast/ToastContext";
import {
  downloadStudentCsvTemplate,
  extractStudentsFromCsvRows,
  getEditedInvalidTagState,
  getInvalidStudentIndices,
  getUniqueStudents,
  getValidationError,
  normalizeStudentIdentifier,
  parseCsvText,
} from "@/utils/classes/addStudentModal";

export default function useAddStudent(fetchClassDetails: () => void) {
  const dispatch = useAppDispatch();
  const { openAddStudentModal } = useAppSelector((state) => state.class);
  const [addStudent, { loading }] = useAddStudentInClass({ classId: openAddStudentModal?.id || "" });
  const [value, setValue] = useState("");
  const [students, setStudents] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const { triggerToast } = useToast();

  const invalidStudentIndices = useMemo(() => getInvalidStudentIndices(students), [students]);

  useEffect(() => {
    if (openAddStudentModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [openAddStudentModal]);

  const showValidationToast = (input: string) => {
    const validationError = getValidationError(input);

    if (!validationError) return false;

    triggerToast({
      ...validationError,
      type: "error",
    });

    return true;
  };

  const focusTagInputAtEnd = () => {
    requestAnimationFrame(() => {
      tagInputRef.current?.focus();
      const inputLength = tagInputRef.current?.value.length || 0;
      tagInputRef.current?.setSelectionRange(inputLength, inputLength);
    });
  };

  const addTag = () => {
    const trimmed = value.trim();

    if (!trimmed) return;

    const normalizedValue = normalizeStudentIdentifier(trimmed);

    if (students.some((student) => normalizeStudentIdentifier(student) === normalizedValue)) {
      triggerToast({
        title: "Duplicate student",
        description: "This phone or email is already in the list.",
        type: "error",
      });
      return;
    }

    if (showValidationToast(trimmed)) return;

    setStudents((prev) => [...prev, trimmed]);
    setValue("");
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const fileText = await file.text();
      const parsedRows = parseCsvText(fileText);
      const parsedStudents = extractStudentsFromCsvRows(parsedRows);

      const uniqueStudents = getUniqueStudents(parsedStudents, students);

      if (parsedStudents.length === 0) {
        triggerToast({
          title: "Empty CSV",
          description: "No phone number or email was found in the uploaded CSV file.",
          type: "error",
        });
        return;
      }

      if (uniqueStudents.length === 0) {
        triggerToast({
          title: "No new students added",
          description: "All items in this CSV are already in the list.",
          type: "error",
        });
        return;
      }

      setStudents((prev) => [...prev, ...uniqueStudents]);
      triggerToast({
        title: "CSV uploaded",
        description: `${uniqueStudents.length} unique item${uniqueStudents.length > 1 ? "s" : ""} added to the student list.`,
        type: "success",
      });
    } catch {
      triggerToast({
        title: "CSV upload failed",
        description: "We could not read the CSV file. Please try again with a valid CSV file.",
        type: "error",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    downloadStudentCsvTemplate();
  };

  const removeTag = (index: number) => {
    setStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTagClick = (index: number) => {
    if (!invalidStudentIndices.includes(index)) return;

    const { nextStudents, nextValue } = getEditedInvalidTagState(students, index, value);

    setStudents(nextStudents);
    setValue(nextValue);
    focusTagInputAtEnd();
  };

  const handleClose = () => {
    dispatch(setOpenAddStudentModal(null));
  };

  const handleAddStudent = () => {
    if (students.length === 0) {
      triggerToast({
        title: "No students added",
        description: "Please add at least one student email or phone number.",
        type: "error",
      });
    } else if (invalidStudentIndices.length > 0) {
      triggerToast({
        title: "Fix validation errors",
        description: "Fix validation of phone or email and try again.",
        type: "error",
      });
    } else {
      addStudent({ students }).then((res) => {
        if (res?.statusCode === 201) {
          handleClose();
          fetchClassDetails();
        }
      });
    }
  };

  return {
    openAddStudentModal,
    value,
    setValue,
    students,
    fileInputRef,
    tagInputRef,
    invalidStudentIndices,
    loading,
    addTag,
    handleCsvUpload,
    handleDownloadTemplate,
    removeTag,
    handleTagClick,
    handleClose,
    handleAddStudent,
  };
}
