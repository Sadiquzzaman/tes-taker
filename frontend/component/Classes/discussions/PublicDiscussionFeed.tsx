"use client";

import DiscussionComposer from "./DiscussionComposer";
import DiscussionPostCard from "./DiscussionPostCard";
import { CATEGORY_FILTERS } from "@/utils/classes/discussionHelpers";

const PublicDiscussionFeed = ({
  classId,
  subjectTitle,
  posts,
  postsMeta,
  loadingPosts,
  postsError,
  submitting,
  categoryFilter,
  openComments,
  commentDrafts,
  currentUserId,
  onCategoryFilterChange,
  onSubmitPost,
  onLoadMore,
  onToggleComments,
  onCommentDraftChange,
  onSubmitComment,
  onEditPost,
  onDeletePost,
  onDeleteComment,
}: {
  classId: string;
  subjectTitle: string;
  posts: DiscussionPost[];
  postsMeta: DiscussionPageMeta | null;
  loadingPosts: boolean;
  postsError: string | null;
  submitting: boolean;
  categoryFilter: DiscussionPostCategory | "all";
  openComments: Record<string, DiscussionComment[]>;
  commentDrafts: Record<string, string>;
  currentUserId?: string;
  onCategoryFilterChange: (value: DiscussionPostCategory | "all") => void;
  onSubmitPost: (payload: {
    content: string;
    category: DiscussionPostCategory;
    attachments: DiscussionAttachment[];
  }) => Promise<void>;
  onLoadMore: () => void;
  onToggleComments: (postId: string) => void;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string) => void;
  onEditPost: (postId: string, content: string) => Promise<void>;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
}) => {
  const canLoadMore = Boolean(postsMeta && postsMeta.page < postsMeta.total_pages);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-title-sm font-semibold text-ink">Class Discussion</h3>
          {subjectTitle ? <p className="text-body-sm text-ink-muted">{subjectTitle}</p> : null}
        </div>
      </div>

      <DiscussionComposer
        classId={classId}
        submitting={submitting}
        onSubmit={onSubmitPost}
      />

      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onCategoryFilterChange(filter.value)}
            className={`rounded-full px-3 py-1.5 text-caption font-medium ${
              categoryFilter === filter.value
                ? "bg-primary text-ink-inverse"
                : "bg-canvas text-ink"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {postsError ? <p className="text-body-sm text-danger">{postsError}</p> : null}
      {loadingPosts && posts.length === 0 ? (
        <p className="text-body-sm text-ink-muted">Loading discussions…</p>
      ) : null}
      {!loadingPosts && posts.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-canvas px-4 py-8 text-center text-body-sm text-ink-muted">
          No posts yet. Start the conversation.
        </p>
      ) : null}

      <div className="space-y-3">
        {posts.map((post) => (
          <DiscussionPostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            comments={openComments[post.id]}
            commentDraft={commentDrafts[post.id] || ""}
            onCommentDraftChange={(value) => onCommentDraftChange(post.id, value)}
            onToggleComments={() => onToggleComments(post.id)}
            onSubmitComment={() => onSubmitComment(post.id)}
            onEdit={onEditPost}
            onDelete={() => onDeletePost(post.id)}
            onDeleteComment={(commentId) => onDeleteComment(post.id, commentId)}
          />
        ))}
      </div>

      {canLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingPosts}
          className="w-full rounded-card border border-border py-2 text-body-sm font-medium text-ink"
        >
          {loadingPosts ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
};

export default PublicDiscussionFeed;
