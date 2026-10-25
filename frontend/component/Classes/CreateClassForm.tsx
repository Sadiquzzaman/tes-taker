"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonClasses, Card, Input, Textarea } from "@/design/ui";
import useCreateClassForm from "@/hooks/classes/useCreateClassForm";
import StudentInviteFields from "./StudentInviteFields";

/** Create a class: its name and description, then (optionally) the students to invite. */
const CreateClassForm = () => {
  const t = useTranslations("classes.form");
  const {
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
    isIndividual,
  } = useCreateClassForm();
  const classesHref = isIndividual ? "/classes" : "/organization/classes";

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        handleCreateClass();
      }}
    >
      <Card title={t("detailsStep")}>
        <div className="flex flex-col gap-4">
          <Input
            label={t("name")}
            required
            value={createClassPayload.class_name}
            onChange={(event) => setCreateClassPayload((prev) => ({ ...prev, class_name: event.target.value }))}
            placeholder={t("namePlaceholder")}
          />
          <Textarea
            label={t("description")}
            rows={3}
            value={createClassPayload.description}
            onChange={(event) => setCreateClassPayload((prev) => ({ ...prev, description: event.target.value }))}
            placeholder={t("descriptionPlaceholder")}
          />
        </div>
      </Card>
      <Card title={t("studentsStep")}>
        <StudentInviteFields
          value={value}
          onChange={setValue}
          tags={createClassPayload.student_ids}
          onAdd={addTag}
          onRemove={removeTag}
          invalidIndices={invalidStudentIndices}
          onTagClick={handleTagClick}
          inputRef={tagInputRef}
          fileInputRef={fileInputRef}
          onCsvUpload={handleCsvUpload}
          onDownloadTemplate={handleDownloadTemplate}
        />
      </Card>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <NextLink href={classesHref} className={buttonClasses({ variant: "secondary" })}>
          {t("cancel")}
        </NextLink>
        <Button type="submit" loading={loading}>
          {loading ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
};

export default CreateClassForm;
