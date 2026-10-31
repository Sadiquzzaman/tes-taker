"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { isPlanErrorCode } from "@/component/Subscription/LockedFeatureProvider";
import { useApiError } from "@/hooks/api/useApiError";
import { uploadDiscussionAttachment } from "@/utils/classes/discussionHelpers";

/**
 * Uploads discussion attachments one by one with progress (FND-15). A full workspace storage
 * (403 PLAN_LIMIT_REACHED) opens the plan-limit dialog; at 90% a warning is shown (FND-16).
 */
const useAttachmentUploads = (classId: string) => {
  const t = useTranslations("discussions");
  const { handleError } = useApiError();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [storageWarning, setStorageWarning] = useState(false);

  /** Uploaded attachments, or an error message (empty when a dialog already explained it). */
  const upload = async (files: File[]): Promise<{ attachments: DiscussionAttachment[]; error?: string }> => {
    setUploading(true);
    const attachments: DiscussionAttachment[] = [];
    try {
      for (const file of files) {
        setProgress(0);
        const result = await uploadDiscussionAttachment(classId, file, { onProgress: setProgress });
        attachments.push(result.attachment);
        if (result.storageWarning) setStorageWarning(true);
      }
      return { attachments };
    } catch (caught) {
      const error = caught as AxiosError<ApiError>;
      if (error.response?.status === 403 && isPlanErrorCode(error.response.data?.code)) {
        handleError(error);
        return { attachments, error: "" };
      }
      const message = error.response?.data?.message;
      return { attachments, error: (Array.isArray(message) ? message[0] : message) || t("composer.uploadFailed") };
    } finally {
      setUploading(false);
    }
  };

  const status = uploading ? t("composer.uploadingProgress", { percent: progress }) : null;
  const warning = storageWarning ? t("composer.storageWarning") : null;

  return { upload, uploading, status, warning };
};

export default useAttachmentUploads;
