"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, Button, ConfirmDialog, Input, Textarea } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { categoryTone } from "@/utils/classes/discussionHelpers";
import DiscussionAttachmentList from "./DiscussionAttachments";

/** A class post with its comments; its author can edit or delete it. */
const DiscussionPostCard = ({
  post,
  currentUserId,
  comments,
  commentDraft,
  onCommentDraftChange,
  onToggleComments,
  onSubmitComment,
  onEdit,
  onDelete,
  onDeleteComment,
}: {
  post: DiscussionPost;
  currentUserId?: string;
  comments?: DiscussionComment[];
  commentDraft: string;
  onCommentDraftChange: (value: string) => void;
  onToggleComments: () => void;
  onSubmitComment: () => void;
  onEdit: (postId: string, content: string) => Promise<void>;
  onDelete: () => void;
  onDeleteComment: (commentId: string) => void;
}) => {
  const t = useTranslations("discussions");
  const format = useFormat();
  const isAuthor = Boolean(currentUserId && post.author.id === currentUserId);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ type: "post" } | { type: "comment"; id: string } | null>(null);
  const category = post.category || "general";

  const saveEdit = async () => {
    const next = editContent.trim();
    if (!next) return;
    setSaving(true);
    try {
      await onEdit(post.id, next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body-sm font-semibold text-ink">{post.author.name}</p>
          <p className="text-caption text-ink-muted">{post.created_at ? format.dateTime(post.created_at) : ""}</p>
        </div>
        <Badge tone={categoryTone(category)}>{t(`category.${category}`)}</Badge>
      </header>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea label={t("post.editLabel")} hideLabel value={editContent} onChange={(event) => setEditContent(event.target.value)} rows={3} />
          <div className="flex gap-2">
            <Button size="sm" loading={saving} onClick={() => void saveEdit()}>
              {t("post.save")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setEditContent(post.content);
              }}
            >
              {t("post.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {post.content ? <p className="whitespace-pre-wrap text-body-sm text-ink">{post.content}</p> : null}
          {post.attachments?.length ? <DiscussionAttachmentList attachments={post.attachments} /> : null}
        </>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" className="text-primary" aria-expanded={Boolean(comments)} onClick={onToggleComments}>
          {t("post.comments", { count: post.comments_count ?? 0 })}
        </Button>
        {isAuthor ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(true);
                setEditContent(post.content);
              }}
            >
              {t("post.edit")}
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm({ type: "post" })}>
              {t("post.delete")}
            </Button>
          </>
        ) : null}
      </div>

      {comments ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-input bg-canvas px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption font-semibold text-ink">{comment.author.name}</p>
                <p className="text-caption text-ink-muted">{comment.created_at ? format.dateTime(comment.created_at) : ""}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink">{comment.content}</p>
              {currentUserId === comment.author.id ? (
                <Button variant="ghost" size="sm" className="-ml-3 text-danger" onClick={() => setConfirm({ type: "comment", id: comment.id })}>
                  {t("post.delete")}
                </Button>
              ) : null}
            </div>
          ))}
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitComment();
            }}
          >
            <Input
              label={t("post.reply")}
              hideLabel
              value={commentDraft}
              onChange={(event) => onCommentDraftChange(event.target.value)}
              placeholder={t("post.replyPlaceholder")}
              fieldClassName="flex-1"
            />
            <Button type="submit" disabled={!commentDraft.trim()}>
              {t("post.reply")}
            </Button>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        tone="danger"
        title={confirm?.type === "comment" ? t("post.deleteCommentTitle") : t("post.deleteTitle")}
        description={confirm?.type === "post" ? t("post.deleteDetail") : undefined}
        confirmLabel={t("post.delete")}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.type === "post") onDelete();
          if (confirm?.type === "comment") onDeleteComment(confirm.id);
          setConfirm(null);
        }}
      />
    </article>
  );
};

export default DiscussionPostCard;
