import { useState, useRef, useMemo, ChangeEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setOpenAddStudentModal } from "@/lib/features/classSlice";
import useAddStudentInClass from "@/hooks/api/class/useAddStudentInClass";
import { useToast } from "@/component/Toast/ToastContext";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("classes.toast");

  const invalidStudentIndices = useMemo(() => getInvalidStudentIndices(students), [students]);

  const showValidationToast = (input: string) => {
    const validationError = getValidationError(input);

    if (!validationError) return false;

    triggerToast({
      title: t(validationError.title),
      description: t(validationError.description),
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
        title: t("duplicateTitle"),
        description: t("duplicate"),
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
          title: t("emptyCsvTitle"),
          description: t("emptyCsv"),
          type: "error",
        });
        return;
      }

      if (uniqueStudents.length === 0) {
        triggerToast({
          title: t("noNewTitle"),
          description: t("noNew"),
          type: "error",
        });
        return;
      }

      setStudents((prev) => [...prev, ...uniqueStudents]);
      triggerToast({
        title: t("csvAddedTitle"),
        description: t("csvAdded", { count: uniqueStudents.length }),
        type: "success",
      });
    } catch {
      triggerToast({
        title: t("csvFailedTitle"),
        description: t("csvFailed"),
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
        title: t("noStudentsTitle"),
        description: t("noStudents"),
        type: "error",
      });
    } else if (invalidStudentIndices.length > 0) {
      triggerToast({
        title: t("fixTitle"),
        description: t("fix"),
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
