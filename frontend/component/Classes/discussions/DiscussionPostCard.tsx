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
    <article className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[#101828]">{post.author.name}</p>
          <p className="text-[12px] text-[#667085]">{formatDiscussionTime(post.created_at)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${categoryPillClass(post.category)}`}>
          {post.category || "general"}
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[14px] outline-none focus:border-[#49734F]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveEdit()}
              className="rounded-[8px] bg-[#49734F] px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditContent(post.content);
              }}
              className="rounded-[8px] border border-[#D0D5DD] px-3 py-1.5 text-[12px] font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.content ? (
            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-[#101828]">{post.content}</p>
          ) : null}
          {post.attachments?.length ? (
            <div className="mt-3">
              <DiscussionAttachmentList attachments={post.attachments} />
            </div>
          ) : null}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[#667085]">
        <button type="button" onClick={onToggleComments} className="font-medium text-[#49734F] hover:underline">
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
            <button type="button" onClick={onDelete} className="text-[#B42318] hover:underline">
              Delete
            </button>
          </>
        ) : null}
      </div>

      {comments ? (
        <div className="mt-3 space-y-3 border-t border-[#F2F4F7] pt-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-[10px] bg-[#F9FAFB] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-[#344054]">{comment.author.name}</p>
                <p className="text-[11px] text-[#98A2B3]">{formatDiscussionTime(comment.created_at)}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#101828]">{comment.content}</p>
              {currentUserId === comment.author.id ? (
                <button
                  type="button"
                  onClick={() => onDeleteComment(comment.id)}
                  className="mt-1 text-[11px] text-[#B42318] hover:underline"
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
              className="min-w-0 flex-1 rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[13px] outline-none focus:border-[#49734F]"
            />
            <button
              type="button"
              onClick={onSubmitComment}
              className="rounded-[10px] bg-[#49734F] px-3 py-2 text-[12px] font-semibold text-white"
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
