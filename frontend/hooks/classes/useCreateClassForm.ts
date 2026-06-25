import { useMemo, useRef, useState, ChangeEvent } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import useCreateClass from "@/hooks/api/class/useCreateClass";
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

export default function useCreateClassForm() {
  const { triggerToast } = useToast();
  const [mutate, { loading }] = useCreateClass();
  const [createClassPayload, setCreateClassPayload] = useState<CreateClassPayload>({
    class_name: "",
    description: "",
    student_ids: [],
  });

  const [value, setValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  const invalidStudentIndices = useMemo(
    () => getInvalidStudentIndices(createClassPayload.student_ids),
    [createClassPayload.student_ids],
  );

  const showValidationToast = (input: string) => {
    const validationError = getValidationError(input);

    if (!validationError) return false;

    triggerToast({ ...validationError, type: "error" });
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

    if (
      createClassPayload.student_ids.some((student) => normalizeStudentIdentifier(student) === normalizedValue)
    ) {
      triggerToast({
        title: "Duplicate student",
        description: "This phone or email is already in the list.",
        type: "error",
      });
      return;
    }

    if (showValidationToast(trimmed)) return;

    setCreateClassPayload((prev) => ({ ...prev, student_ids: [...prev.student_ids, trimmed] }));
    setValue("");
  };

  const removeTag = (index: number) => {
    setCreateClassPayload((prev) => ({
      ...prev,
      student_ids: prev.student_ids.filter((_, i) => i !== index),
    }));
  };

  const handleTagClick = (index: number) => {
    if (!invalidStudentIndices.includes(index)) return;

    const { nextStudents, nextValue } = getEditedInvalidTagState(createClassPayload.student_ids, index, value);

    setCreateClassPayload((prev) => ({ ...prev, student_ids: nextStudents }));
    setValue(nextValue);
    focusTagInputAtEnd();
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const fileText = await file.text();
      const parsedRows = parseCsvText(fileText);
      const parsedStudents = extractStudentsFromCsvRows(parsedRows);

      if (parsedStudents.length === 0) {
        triggerToast({
          title: "Empty CSV",
          description: "No phone number or email was found in the uploaded CSV file.",
          type: "error",
        });
        return;
      }

      const uniqueStudents = getUniqueStudents(parsedStudents, createClassPayload.student_ids);

      if (uniqueStudents.length === 0) {
        triggerToast({
          title: "No new students added",
          description: "All items in this CSV are already in the list.",
          type: "error",
        });
        return;
      }

      setCreateClassPayload((prev) => ({ ...prev, student_ids: [...prev.student_ids, ...uniqueStudents] }));
      triggerToast({
        title: "CSV uploaded",
        description: `${uniqueStudents.length} unique item${
          uniqueStudents.length > 1 ? "s" : ""
        } added to the student list.`,
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

  const handleCreateClass = () => {
    if (createClassPayload.class_name.trim() === "") {
      triggerToast({
        title: "Class name is required",
        description: "Please enter a class name.",
        type: "error",
      });
      return;
    }

    if (invalidStudentIndices.length > 0) {
      triggerToast({
        title: "Fix validation errors",
        description: "Fix validation of phone or email and try again.",
        type: "error",
      });
      return;
    }

    mutate(createClassPayload);
  };

  return {
    createClassPayload,
    setCreateClassPayload,
    value,
    setValue,
    loading,
    fileInputRef,
    tagInputRef,
    invalidStudentIndices,
    addTag,
    removeTag,
    handleTagClick,
    handleCsvUpload,
    handleDownloadTemplate,
    handleCreateClass,
  };
}
