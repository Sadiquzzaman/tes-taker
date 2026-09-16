"use client";

import { useRef, useState } from "react";
import AttachmentChip from "./AttachmentChip";
import {
  CATEGORY_OPTIONS,
  uploadDiscussionAttachment,
} from "@/utils/classes/discussionHelpers";

const DiscussionComposer = ({
  classId,
  disabled,
  submitting,
  placeholder = "Ask a question or start a discussion...",
  submitLabel = "Post",
  showCategory = true,
  onSubmit,
}: {
  classId: string;
  disabled?: boolean;
  submitting?: boolean;
  placeholder?: string;
  submitLabel?: string;
  showCategory?: boolean;
  onSubmit: (payload: {
    content: string;
    category: DiscussionPostCategory;
    attachments: DiscussionAttachment[];
  }) => Promise<void> | void;
}) => {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<DiscussionPostCategory>("question");
  const [attachments, setAttachments] = useState<DiscussionAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");

  const canSubmit = Boolean(content.trim() || attachments.length) && !disabled && !uploading && !submitting;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (attachments.length >= 5) {
      setLocalError("You can attach up to 5 files.");
      return;
    }
    setLocalError("");
    setUploading(true);
    try {
      const remaining = 5 - attachments.length;
      const selected = Array.from(files).slice(0, remaining);
      const uploaded: DiscussionAttachment[] = [];
      for (const file of selected) {
        uploaded.push(await uploadDiscussionAttachment(classId, file));
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (error: any) {
      setLocalError(error?.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({ content: content.trim(), category, attachments });
    setContent("");
    setAttachments([]);
    setCategory("question");
  };

  return (
    <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
      {showCategory ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategory(option.value)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                category === option.value
                  ? "bg-[#49734F] text-white"
                  : "bg-[#F2F4F7] text-[#344054]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={4000}
        disabled={disabled || submitting}
        className="w-full resize-y rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[14px] text-[#101828] outline-none focus:border-[#49734F]"
      />

      {attachments.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              onRemove={() =>
                setAttachments((current) => current.filter((item) => item.id !== attachment.id))
              }
            />
          ))}
        </div>
      ) : null}

      {localError ? <p className="mt-2 text-[13px] text-[#B42318]">{localError}</p> : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={disabled || uploading || attachments.length >= 5}
            onClick={() => imageInputRef.current?.click()}
            className="rounded-[8px] border border-[#D0D5DD] px-3 py-1.5 text-[12px] font-medium text-[#344054] disabled:opacity-50"
          >
            Image
          </button>
          <button
            type="button"
            disabled={disabled || uploading || attachments.length >= 5}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-[8px] border border-[#D0D5DD] px-3 py-1.5 text-[12px] font-medium text-[#344054] disabled:opacity-50"
          >
            File
          </button>
          {uploading ? <span className="text-[12px] text-[#667085]">Uploading…</span> : null}
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="rounded-[10px] bg-[#49734F] px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Sending…" : submitLabel}
        </button>
      </div>
    </div>
  );
};

export default DiscussionComposer;
