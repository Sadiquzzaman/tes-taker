"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button, cn, focusRing, Textarea } from "@/design/ui";
import { CATEGORY_OPTIONS } from "@/utils/classes/discussionHelpers";
import AttachmentChip from "./AttachmentChip";
import useAttachmentUploads from "./useAttachmentUploads";

const MAX_FILES = 5;

/** Write a class post: pick its type, add up to 5 images or files, post. */
const DiscussionComposer = ({
  classId,
  disabled,
  submitting,
  onSubmit,
}: {
  classId: string;
  disabled?: boolean;
  submitting?: boolean;
  onSubmit: (payload: { content: string; category: DiscussionPostCategory; attachments: DiscussionAttachment[] }) => Promise<void> | void;
}) => {
  const t = useTranslations("discussions");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<DiscussionPostCategory>("question");
  const [attachments, setAttachments] = useState<DiscussionAttachment[]>([]);
  const [localError, setLocalError] = useState("");
  const { upload, uploading, status, warning } = useAttachmentUploads(classId);

  const canSubmit = Boolean(content.trim() || attachments.length) && !disabled && !uploading && !submitting;
  const full = attachments.length >= MAX_FILES;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (full) {
      setLocalError(t("composer.maxFiles"));
      return;
    }
    setLocalError("");
    const result = await upload(Array.from(files).slice(0, MAX_FILES - attachments.length));
    setAttachments((current) => [...current, ...result.attachments]);
    if (result.error !== undefined) setLocalError(result.error);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await onSubmit({ content: content.trim(), category, attachments });
      setContent("");
      setAttachments([]);
      setCategory("question");
      setLocalError("");
    } catch (caught) {
      const error = caught as AxiosError<{ message?: string | string[] }>;
      const message = error.response?.data?.message;
      setLocalError(Array.isArray(message) ? message[0] : message || t("composer.postFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
      <div role="radiogroup" aria-label={t("composer.category")} className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={category === option}
            onClick={() => setCategory(option)}
            className={cn(
              "rounded-full px-3 py-1 text-caption font-medium",
              category === option ? "bg-primary text-ink-inverse" : "bg-canvas text-ink hover:bg-border",
              focusRing,
            )}
          >
            {t(`category.${option}`)}
          </button>
        ))}
      </div>
      <Textarea
        label={t("composer.label")}
        hideLabel
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={t("composer.placeholder")}
        rows={3}
        maxLength={4000}
        disabled={disabled || submitting}
        error={localError || undefined}
      />
      {warning ? <p className="text-caption text-warning">{warning}</p> : null}
      {attachments.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              onRemove={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
          />
          <Button variant="secondary" size="sm" disabled={disabled || uploading || full} onClick={() => imageInputRef.current?.click()}>
            {t("composer.image")}
          </Button>
          <Button variant="secondary" size="sm" disabled={disabled || uploading || full} onClick={() => fileInputRef.current?.click()}>
            {t("composer.file")}
          </Button>
          {status ? (
            <span className="text-caption text-ink-muted" role="status">
              {status}
            </span>
          ) : null}
        </div>
        <Button disabled={!canSubmit} loading={submitting} onClick={() => void handleSubmit()}>
          {submitting ? t("composer.posting") : t("composer.post")}
        </Button>
      </div>
    </div>
  );
};

export default DiscussionComposer;
