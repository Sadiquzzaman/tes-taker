"use client";

import { useState } from "react";
import DiscussionAttachmentList from "./DiscussionAttachments";
import {
  categoryPillClass,
  formatDiscussionTime,
} from "@/utils/classes/discussionHelpers";

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
  const isAuthor = Boolean(currentUserId && post.author.id === currentUserId);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);

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
    <article className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body-sm font-semibold text-ink">{post.author.name}</p>
          <p className="text-caption text-ink-muted">{formatDiscussionTime(post.created_at)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-caption font-semibold capitalize ${categoryPillClass(post.category)}`}>
          {post.category || "general"}
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full rounded-card border border-border px-3 py-2 text-body-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveEdit()}
              className="rounded-input bg-primary px-3 py-1.5 text-caption font-semibold text-ink-inverse"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditContent(post.content);
              }}
              className="rounded-input border border-border px-3 py-1.5 text-caption font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.content ? (
            <p className="mt-3 whitespace-pre-wrap text-body-sm leading-6 text-ink">{post.content}</p>
          ) : null}
          {post.attachments?.length ? (
            <div className="mt-3">
              <DiscussionAttachmentList attachments={post.attachments} />
            </div>
          ) : null}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-caption text-ink-muted">
        <button type="button" onClick={onToggleComments} className="font-medium text-primary hover:underline">
          Comments ({post.comments_count ?? 0})
        </button>
        {isAuthor ? (
          <>
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setEditContent(post.content);
              }}
              className="hover:underline"
            >
              Edit
            </button>
            <button type="button" onClick={onDelete} className="text-danger hover:underline">
              Delete
            </button>
          </>
        ) : null}
      </div>

      {comments ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-card bg-canvas px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption font-semibold text-ink">{comment.author.name}</p>
                <p className="text-caption text-ink-muted">{formatDiscussionTime(comment.created_at)}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink">{comment.content}</p>
              {currentUserId === comment.author.id ? (
                <button
                  type="button"
                  onClick={() => onDeleteComment(comment.id)}
                  className="mt-1 text-caption text-danger hover:underline"
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={commentDraft}
              onChange={(e) => onCommentDraftChange(e.target.value)}
              placeholder="Write a reply..."
              className="min-w-0 flex-1 rounded-card border border-border px-3 py-2 text-body-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={onSubmitComment}
              className="rounded-card bg-primary px-3 py-2 text-caption font-semibold text-ink-inverse"
            >
              Reply
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
};

export default DiscussionPostCard;
