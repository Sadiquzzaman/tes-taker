"use client";

import { useMemo, useRef, useState } from "react";
import DropDownComponent from "@/Ui/DropDownComponent";
import ChatBubble from "./ChatBubble";
import AttachmentChip from "./AttachmentChip";
import { uploadDiscussionAttachment } from "@/utils/classes/discussionHelpers";

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
  onSendMessage: (payload: {
    content: string;
    attachments: DiscussionAttachment[];
  }) => Promise<void>;
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<DiscussionAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conversation) => {
      const label = isTeacher ? conversation.student.name : conversation.teacher.name;
      return label.toLowerCase().includes(q);
    });
  }, [conversations, isTeacher, search]);

  const activeConversation = conversations.find((item) => item.id === activeConversationId);
  const peerName = activeConversation
    ? isTeacher
      ? activeConversation.student.name
      : activeConversation.teacher.name
    : "";

  const canSend =
    Boolean(activeConversationId) &&
    Boolean(content.trim() || attachments.length) &&
    !uploading &&
    !submitting;

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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    await onSendMessage({ content: content.trim(), attachments });
    setContent("");
    setAttachments([]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[20px] font-semibold text-[#101828]">Private Discussion</h3>
        <p className="text-[13px] text-[#667085]">One-to-one chat for this subject</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[14px] border border-[#E5E7EB] bg-white p-3 shadow-sm">
          <div className="space-y-2">
            <DropDownComponent
              list={startOptions}
              value={startWithId}
              handleChange={onStartWithChange}
              placeholder={isTeacher ? "Start with student" : "Start with teacher"}
            />
            <button
              type="button"
              onClick={onStartConversation}
              disabled={!startWithId}
              className="w-full rounded-[10px] bg-[#49734F] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              Start conversation
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[13px] outline-none focus:border-[#49734F]"
            />
          </div>

          <div className="mt-3 max-h-[420px] space-y-1 overflow-y-auto">
            {loadingConversations ? <p className="px-2 py-3 text-[12px] text-[#667085]">Loading…</p> : null}
            {conversationsError ? <p className="px-2 text-[12px] text-[#B42318]">{conversationsError}</p> : null}
            {!loadingConversations && filteredConversations.length === 0 ? (
              <p className="px-2 py-3 text-[12px] text-[#667085]">No conversations yet.</p>
            ) : null}
            {filteredConversations.map((conversation) => {
              const name = isTeacher ? conversation.student.name : conversation.teacher.name;
              const active = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left ${
                    active ? "bg-[#E8F5E9]" : "hover:bg-[#F9FAFB]"
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D1E7D4] text-[12px] font-semibold text-[#49734F]">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="block truncate text-[13px] font-medium text-[#101828]">{name}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-[480px] flex-col rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm">
          <div className="border-b border-[#E5E7EB] px-4 py-3">
            <p className="text-[15px] font-semibold text-[#101828]">{peerName || "Select a conversation"}</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!activeConversationId ? (
              <p className="text-[13px] text-[#667085]">Choose a conversation to start chatting.</p>
            ) : messages.length === 0 ? (
              <p className="text-[13px] text-[#667085]">No messages yet. Say hello.</p>
            ) : (
              messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  isOwn={Boolean(currentUserId && message.sender.id === currentUserId)}
                />
              ))
            )}
          </div>

          <div className="border-t border-[#E5E7EB] p-3">
            {attachments.length > 0 ? (
              <div className="mb-2 grid gap-2 sm:grid-cols-2">
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
            {localError ? <p className="mb-2 text-[12px] text-[#B42318]">{localError}</p> : null}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.txt,application/pdf"
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <button
                type="button"
                disabled={!activeConversationId || uploading || attachments.length >= 5}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[12px] font-medium text-[#344054] disabled:opacity-50"
              >
                Attach
              </button>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={!activeConversationId || submitting}
                placeholder="Type a message..."
                rows={2}
                maxLength={4000}
                className="min-w-0 flex-1 resize-none rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[13px] outline-none focus:border-[#49734F]"
              />
              <button
                type="button"
                disabled={!canSend}
                onClick={() => void handleSend()}
                className="rounded-[10px] bg-[#49734F] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "…" : "Send"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrivateDiscussionPane;
