"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import useFormat from "@/i18n/useFormat";
import { cn, focusRing } from "./cn";
import IconButton from "./IconButton";
import { CloseIcon, UploadIcon } from "./icons";

export interface FileDropItem {
  /** Stable id for the list (e.g. name + lastModified). */
  id: string;
  name: string;
  /** 0–100 while uploading or compressing (FND-15); leave out when not started. */
  progress?: number;
  error?: string;
}

export interface FileDropProps {
  label: ReactNode;
  /** Called with the accepted files; files over `maxSizeMb` are reported as errors instead. */
  onFiles: (files: File[]) => void;
  /** Files already chosen, shown under the drop zone with their progress. */
  items?: FileDropItem[];
  onRemove?: (id: string) => void;
  /** e.g. "image/*,.pdf" */
  accept?: string;
  /** Shown to the user, e.g. "JPG, PNG or PDF". */
  acceptLabel?: string;
  maxSizeMb?: number;
  multiple?: boolean;
  disabled?: boolean;
  error?: ReactNode;
  className?: string;
}

/** Drag-and-drop or click to choose files, with a progress bar per file. Keyboard: Tab to it, Enter/Space opens the picker. */
const FileDrop = ({
  label,
  onFiles,
  items = [],
  onRemove,
  accept,
  acceptLabel,
  maxSizeMb = 10,
  multiple = false,
  disabled = false,
  error,
  className,
}: FileDropProps) => {
  const t = useTranslations("ui.fileDrop");
  const format = useFormat();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sizeErrors, setSizeErrors] = useState<string[]>([]);

  const takeFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) {
      return;
    }
    const files = Array.from(fileList).slice(0, multiple ? undefined : 1);
    const tooLarge = files.filter((file) => file.size > maxSizeMb * 1024 * 1024);
    setSizeErrors(tooLarge.map((file) => t("tooLarge", { name: file.name, size: maxSizeMb })));
    const ok = files.filter((file) => !tooLarge.includes(file));
    if (ok.length) {
      onFiles(ok);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    takeFiles(event.dataTransfer.files);
  };

  const errors = [...sizeErrors, ...(error ? [error] : [])];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-body-sm font-medium text-ink">
        {label}
      </label>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-describedby={`${id}-limits`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-8 text-center",
          "transition-colors duration-(--motion-fast) ease-fast",
          isDragging ? "border-primary bg-primary-soft" : "border-border bg-canvas hover:border-ink-muted",
          errors.length ? "border-danger" : undefined,
          disabled && "cursor-not-allowed opacity-50",
          focusRing,
        )}
      >
        <UploadIcon className="size-6 text-ink-muted" />
        <p className="text-body-sm text-ink">
          {t.rich("prompt", { browse: (chunks) => <span className="font-medium text-primary underline">{chunks}</span> })}
        </p>
        <p id={`${id}-limits`} className="text-caption text-ink-muted">
          {t("limits", { types: acceptLabel ?? "", size: maxSizeMb })}
        </p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {errors.map((message, index) => (
        <p key={index} className="text-caption text-danger">
          {message}
        </p>
      ))}
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-input border border-border bg-surface px-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="truncate text-ink">{item.name}</span>
                  {typeof item.progress === "number" ? (
                    <span className="shrink-0 text-ink-muted">{format.number(Math.round(item.progress))}%</span>
                  ) : null}
                </div>
                {typeof item.progress === "number" ? (
                  <div
                    role="progressbar"
                    aria-label={item.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress)}
                    className="h-1.5 overflow-hidden rounded-full bg-canvas"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-(--motion-fast)"
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                ) : null}
                {item.error ? <span className="text-caption text-danger">{item.error}</span> : null}
              </div>
              {onRemove ? (
                <IconButton
                  size="sm"
                  label={t("remove", { name: item.name })}
                  icon={<CloseIcon />}
                  onClick={() => onRemove(item.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default FileDrop;
