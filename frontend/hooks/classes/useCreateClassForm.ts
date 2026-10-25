import { useEffect, useMemo, useRef, useState, ChangeEvent } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { useTranslations } from "next-intl";
import useCreateClass from "@/hooks/api/class/useCreateClass";
import useWorkspace from "@/hooks/organization/useWorkspace";
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
  const t = useTranslations("classes.toast");
  const { isIndividual } = useWorkspace();
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

    if (createClassPayload.student_ids.some((student) => normalizeStudentIdentifier(student) === normalizedValue)) {
      triggerToast({
        title: t("duplicateTitle"),
        description: t("duplicate"),
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
          title: t("emptyCsvTitle"),
          description: t("emptyCsv"),
          type: "error",
        });
        return;
      }

      const uniqueStudents = getUniqueStudents(parsedStudents, createClassPayload.student_ids);

      if (uniqueStudents.length === 0) {
        triggerToast({
          title: t("noNewTitle"),
          description: t("noNew"),
          type: "error",
        });
        return;
      }

      setCreateClassPayload((prev) => ({ ...prev, student_ids: [...prev.student_ids, ...uniqueStudents] }));
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

  const handleCreateClass = () => {
    if (createClassPayload.class_name.trim() === "") {
      triggerToast({
        title: t("nameRequiredTitle"),
        description: t("nameRequired"),
        type: "error",
      });
      return;
    }

    if (invalidStudentIndices.length > 0) {
      triggerToast({
        title: t("fixTitle"),
        description: t("fix"),
        type: "error",
      });
      return;
    }

    mutate(
      isIndividual
        ? {
            class_name: createClassPayload.class_name,
            description: createClassPayload.description,
            student_ids: createClassPayload.student_ids,
          }
        : createClassPayload,
    );
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
    isIndividual,
    addTag,
    removeTag,
    handleTagClick,
    handleCsvUpload,
    handleDownloadTemplate,
    handleCreateClass,
  };
}
