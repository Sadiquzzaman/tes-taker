"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, Button, cn, FilterBar, focusRing, Select, Skeleton, Textarea } from "@/design/ui";
import useAttachmentUploads from "./useAttachmentUploads";
import AttachmentChip from "./AttachmentChip";
import ChatBubble from "./ChatBubble";

const MAX_FILES = 5;

/** One-to-one messages between a teacher and a student about one subject. */
const PrivateDiscussionPane = ({
  classId,
  currentUserId,
  isTeacher,
  conversations,
  loadingConversations,
  conversationsError,
  activeConversationId,
  messages,
  startOptions,
  startWithId,
  submitting,
  onSelectConversation,
  onStartWithChange,
  onStartConversation,
  onSendMessage,
}: {
  classId: string;
  currentUserId?: string;
  isTeacher: boolean;
  conversations: DiscussionConversation[];
  loadingConversations: boolean;
  conversationsError: string | null;
  activeConversationId: string;
  messages: DiscussionMessage[];
  startOptions: DropDownOption[];
  startWithId: string;
  submitting: boolean;
  onSelectConversation: (id: string) => void;
  onStartWithChange: (id: string) => void;
  onStartConversation: () => void;
  onSendMessage: (payload: { content: string; attachments: DiscussionAttachment[] }) => Promise<void>;
}) => {
  const t = useTranslations("discussions");
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<DiscussionAttachment[]>([]);
  const [localError, setLocalError] = useState("");
  const { upload, uploading, status, warning } = useAttachmentUploads(classId);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  const peerOf = (conversation: DiscussionConversation) => (isTeacher ? conversation.student.name : conversation.teacher.name);
  const needle = search.trim().toLocaleLowerCase();
  const visible = needle ? conversations.filter((conversation) => peerOf(conversation).toLocaleLowerCase().includes(needle)) : conversations;
  const active = conversations.find((item) => item.id === activeConversationId);
  const canSend = Boolean(activeConversationId) && Boolean(content.trim() || attachments.length) && !uploading && !submitting;

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    if (attachments.length >= MAX_FILES) {
      setLocalError(t("composer.maxFiles"));
      return;
    }
    setLocalError("");
    const result = await upload(files.slice(0, MAX_FILES - attachments.length));
    setAttachments((current) => [...current, ...result.attachments]);
    if (result.error !== undefined) setLocalError(result.error);
  };

  const handleSend = async () => {
    if (!canSend) return;
    try {
      await onSendMessage({ content: content.trim(), attachments });
      setContent("");
      setAttachments([]);
      setLocalError("");
    } catch (caught) {
      const error = caught as AxiosError<{ message?: string | string[] }>;
      const message = error.response?.data?.message;
      setLocalError(Array.isArray(message) ? message[0] : message || t("composer.sendFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-title-sm font-semibold text-ink">{t("chat.title")}</h3>
        <p className="text-body-sm text-ink-muted">{t("chat.intro")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 shadow-card">
          <Select
            label={isTeacher ? t("chat.startWithStudent") : t("chat.startWithTeacher")}
            placeholder={isTeacher ? t("chat.startWithStudent") : t("chat.startWithTeacher")}
            value={startWithId}
            onChange={(event) => onStartWithChange(event.target.value)}
            options={startOptions}
            disabled={startOptions.length === 0}
            hint={startOptions.length === 0 ? (isTeacher ? t("chat.noStudents") : t("chat.noTeachers")) : undefined}
          />
          <Button fullWidth disabled={!startWithId} onClick={onStartConversation}>
            {t("chat.start")}
          </Button>
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t("chat.search")} />
          <nav aria-label={t("chat.conversations")} className="max-h-[420px] overflow-y-auto">
            {loadingConversations ? <Skeleton lines={3} /> : null}
            {conversationsError ? <p className="px-2 text-caption text-danger">{conversationsError}</p> : null}
            {!loadingConversations && visible.length === 0 ? <p className="px-2 py-3 text-caption text-ink-muted">{t("chat.none")}</p> : null}
            <ul className="flex flex-col gap-1">
              {visible.map((conversation) => {
                const name = peerOf(conversation);
                const isActive = conversation.id === activeConversationId;
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      aria-current={isActive || undefined}
                      onClick={() => onSelectConversation(conversation.id)}
                      className={cn("flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-left", isActive ? "bg-primary-soft" : "hover:bg-canvas", focusRing)}
                    >
                      <Avatar name={name} size="sm" />
                      <span className="truncate text-body-sm font-medium text-ink">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <section className="flex min-h-[480px] flex-col rounded-card border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <p className="text-body font-semibold text-ink">{active ? peerOf(active) : t("chat.selectConversation")}</p>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {!activeConversationId ? (
              <p className="text-body-sm text-ink-muted">{t("chat.pick")}</p>
            ) : messages.length === 0 ? (
              <p className="text-body-sm text-ink-muted">{t("chat.noMessages")}</p>
            ) : (
              messages.map((message) => (
                <ChatBubble key={message.id} message={message} isOwn={Boolean(currentUserId && message.sender.id === currentUserId)} />
              ))
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-border p-3">
            {status ? (
              <p className="text-caption text-ink-muted" role="status">
                {status}
              </p>
            ) : null}
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
            <div className="flex items-end gap-2">
              <input
                ref={setFileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.txt,application/pdf"
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void handleFiles(files);
                }}
              />
              <Button variant="secondary" disabled={!activeConversationId || uploading || attachments.length >= MAX_FILES} onClick={() => fileInput?.click()}>
                {t("composer.attach")}
              </Button>
              <Textarea
                label={t("chat.message")}
                hideLabel
                value={content}
                onChange={(event) => setContent(event.target.value)}
                disabled={!activeConversationId || submitting}
                placeholder={t("chat.placeholder")}
                rows={2}
                maxLength={4000}
                error={localError || undefined}
                fieldClassName="min-w-0 flex-1"
                className="resize-none"
              />
              <Button disabled={!canSend} loading={submitting} onClick={() => void handleSend()}>
                {t("chat.send")}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrivateDiscussionPane;
