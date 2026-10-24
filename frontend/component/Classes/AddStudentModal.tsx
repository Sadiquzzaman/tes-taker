"use client";

import { useTranslations } from "next-intl";
import { Button, Drawer } from "@/design/ui";
import useAddStudent from "@/hooks/classes/useAddStudent";
import StudentInviteFields from "./StudentInviteFields";

/** Drawer to invite more students to a class (by email, phone, Student ID or CSV). */
const AddStudentModal = ({ fetchClassDetails }: { fetchClassDetails: () => void }) => {
  const t = useTranslations("classes");
  const {
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
  } = useAddStudent(fetchClassDetails);

  return (
    <Drawer
      open={Boolean(openAddStudentModal)}
      onClose={handleClose}
      title={t("addModal.title")}
      description={t("addModal.intro")}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            {t("form.cancel")}
          </Button>
          <Button onClick={handleAddStudent} loading={loading}>
            {loading ? t("addModal.confirming") : t("addModal.confirm")}
          </Button>
        </>
      }
    >
      <StudentInviteFields
        value={value}
        onChange={setValue}
        tags={students}
        onAdd={addTag}
        onRemove={removeTag}
        invalidIndices={invalidStudentIndices}
        onTagClick={handleTagClick}
        inputRef={tagInputRef}
        fileInputRef={fileInputRef}
        onCsvUpload={handleCsvUpload}
        onDownloadTemplate={handleDownloadTemplate}
      />
    </Drawer>
  );
};

export default AddStudentModal;
