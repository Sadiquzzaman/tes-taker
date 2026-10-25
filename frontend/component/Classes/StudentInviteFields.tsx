"use client";

import { useTranslations } from "next-intl";
import type { ChangeEvent, RefObject } from "react";
import { Button, TagInput } from "@/design/ui";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";

/** Typing or uploading the students to invite (used by Create class and Add students). */
const StudentInviteFields = ({
  value,
  onChange,
  tags,
  onAdd,
  onRemove,
  invalidIndices,
  onTagClick,
  inputRef,
  fileInputRef,
  onCsvUpload,
  onDownloadTemplate,
}: {
  value: string;
  onChange: (value: string) => void;
  tags: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  invalidIndices: number[];
  onTagClick: (index: number) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onCsvUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
}) => {
  const t = useTranslations("classes.form");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <TagInput
          className="flex-1"
          label={t("studentsLabel")}
          hint={t("studentsHint")}
          placeholder={t("studentsPlaceholder")}
          value={value}
          onChange={onChange}
          tags={tags}
          onAdd={onAdd}
          onRemove={onRemove}
          invalidIndices={invalidIndices}
          onTagClick={onTagClick}
          inputRef={inputRef}
          error={invalidIndices.length ? t("invalidHint") : undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" leftIcon={<HumanAddIconSVG />} disabled={!value.trim()} onClick={onAdd}>
          {t("add")}
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onCsvUpload} className="hidden" />
        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          {t("uploadCsv")}
        </Button>
        <Button variant="ghost" size="sm" className="text-primary" onClick={onDownloadTemplate}>
          {t("downloadTemplate")}
        </Button>
      </div>
    </div>
  );
};

export default StudentInviteFields;
