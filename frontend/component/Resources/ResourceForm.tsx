"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Checkbox, Drawer, FileDrop, Input, RadioGroup, Select, TagInput, Textarea } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";
import { uploadMedia } from "@/utils/media/uploadMedia";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;
const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*,audio/*";

/**
 * Adding or changing a resource (RES-01, RES-03, RES-05): a file or a link, title, description,
 * subject, folder, tags, "Students may download it", and the subject classes it is shared with.
 */
const ResourceForm = ({
  open,
  resource,
  options,
  folders,
  onClose,
  onSaved,
}: {
  open: boolean;
  resource: LibraryResource | null;
  options: ResourceShareOption[];
  folders: ResourceFolder[];
  onClose: () => void;
  onSaved: (resource: LibraryResource) => void;
}) => {
  const t = useTranslations("resources");
  const { handleError } = useApiError();
  const editing = Boolean(resource);
  const [type, setType] = useState<"FILE" | "LINK">(resource?.type === "LINK" ? "LINK" : "FILE");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [url, setUrl] = useState(resource?.type === "LINK" ? resource.url : "");
  const [file, setFile] = useState<{ id: string; name: string; progress?: number; sizeBytes?: number; error?: string } | null>(null);
  const [subjectId, setSubjectId] = useState(resource?.subject?.id ?? "");
  const [folderId, setFolderId] = useState(resource?.folder_id ?? "");
  const [tags, setTags] = useState<string[]>(resource?.tags ?? []);
  const [tagText, setTagText] = useState("");
  const [download, setDownload] = useState(resource?.download_allowed ?? true);
  const [shares, setShares] = useState<string[]>(resource?.shares.map((s) => s.offering_id) ?? []);
  const [busy, setBusy] = useState(false);

  const subjects = [...new Map(options.map((o) => [o.subject.id, o.subject.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const upload = async (files: File[]) => {
    const chosen = files[0];
    if (!chosen) return;
    const id = `${chosen.name}-${chosen.lastModified}`;
    setFile({ id, name: chosen.name, progress: 0 });
    try {
      const uploaded = await uploadMedia("resource", chosen, undefined, { onProgress: (progress) => setFile({ id, name: chosen.name, progress }) });
      setFile({ id: uploaded.id, name: uploaded.file_name, sizeBytes: uploaded.size });
      if (!title.trim()) setTitle(chosen.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setFile({ id, name: chosen.name, error: t("uploadFailed") });
      handleError(err as AxiosError<ApiError>);
    }
  };

  const save = async () => {
    setBusy(true);
    const body = {
      title,
      description: description || null,
      subject_id: subjectId || null,
      folder_id: folderId || null,
      tags,
      download_allowed: download,
      offering_ids: shares,
    };
    try {
      const res = editing
        ? await axiosReq.patch<{ payload: LibraryResource }>(`${BASE}/resources/${resource!.id}`, body)
        : await axiosReq.post<{ payload: LibraryResource }>(`${BASE}/resources`, {
            ...body,
            type,
            description: description || undefined,
            subject_id: subjectId || undefined,
            folder_id: folderId || undefined,
            ...(type === "LINK" ? { url } : { file_id: file?.id }),
          });
      onSaved(res.data.payload);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const ready = title.trim() && (editing || (type === "LINK" ? url.trim() : file && !file.error && file.progress === undefined));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editing ? t("editTitle") : t("addTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} disabled={!ready} onClick={() => void save()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!editing ? (
          <RadioGroup
            legend={t("kind")}
            name="resource-kind"
            inline
            value={type}
            onChange={(value) => setType(value as "FILE" | "LINK")}
            options={[
              { value: "FILE", label: t("kindFile"), hint: t("kindFileHint") },
              { value: "LINK", label: t("kindLink"), hint: t("kindLinkHint") },
            ]}
          />
        ) : null}
        {!editing && type === "FILE" ? (
          <FileDrop label={t("file")} onFiles={(files) => void upload(files)} items={file ? [file] : []} onRemove={() => setFile(null)} accept={ACCEPT} acceptLabel={t("fileTypes")} maxSizeMb={20} />
        ) : null}
        {!editing && type === "LINK" ? <Input label={t("url")} type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /> : null}
        <Input label={t("titleLabel")} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label={t("descriptionLabel")} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Select label={t("subject")} placeholder={t("noSubject")} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} options={subjects.map(([id, name]) => ({ value: id, label: name }))} />
        <Select label={t("folder")} placeholder={t("noFolder")} value={folderId} onChange={(e) => setFolderId(e.target.value)} options={folders.map((f) => ({ value: f.id, label: f.name }))} />
        <TagInput
          label={t("tags")}
          value={tagText}
          onChange={setTagText}
          tags={tags}
          onAdd={() => {
            const tag = tagText.trim();
            if (tag && !tags.includes(tag) && tags.length < 10) setTags([...tags, tag]);
            setTagText("");
          }}
          onRemove={(index) => setTags(tags.filter((_, i) => i !== index))}
        />
        <Checkbox label={t("download")} hint={t("downloadHint")} checked={download} onChange={(e) => setDownload(e.target.checked)} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-body-sm font-medium text-ink">{t("shareWith")}</legend>
          {options.length === 0 ? <p className="text-body-sm text-ink-muted">{t("noClasses")}</p> : null}
          {options.map((o) => (
            <Checkbox
              key={o.offering_id}
              label={o.label}
              checked={shares.includes(o.offering_id)}
              onChange={(e) => setShares(e.target.checked ? [...shares, o.offering_id] : shares.filter((id) => id !== o.offering_id))}
            />
          ))}
        </fieldset>
      </div>
    </Drawer>
  );
};

export default ResourceForm;
