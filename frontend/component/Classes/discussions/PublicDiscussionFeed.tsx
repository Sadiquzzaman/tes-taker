"use client";

import { useTranslations } from "next-intl";
import { Button, cn, EmptyState, ErrorState, focusRing, Skeleton } from "@/design/ui";
import { CATEGORY_FILTERS } from "@/utils/classes/discussionHelpers";
import DiscussionComposer from "./DiscussionComposer";
import DiscussionPostCard from "./DiscussionPostCard";

/** The class's public feed for one subject: write a post, filter by type, read and reply. */
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
  onRetry,
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
  onSubmitPost: (payload: { content: string; category: DiscussionPostCategory; attachments: DiscussionAttachment[] }) => Promise<void>;
  onLoadMore: () => void;
  onRetry: () => void;
  onToggleComments: (postId: string) => void;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string) => void;
  onEditPost: (postId: string, content: string) => Promise<void>;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
}) => {
  const t = useTranslations("discussions");
  const canLoadMore = Boolean(postsMeta && postsMeta.page < postsMeta.total_pages);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-title-sm font-semibold text-ink">{t("public")}</h3>
        {subjectTitle ? <p className="text-body-sm text-ink-muted">{subjectTitle}</p> : null}
      </div>

      <DiscussionComposer classId={classId} submitting={submitting} onSubmit={onSubmitPost} />

      <div className="flex flex-wrap gap-2" role="group">
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={categoryFilter === filter}
            onClick={() => onCategoryFilterChange(filter)}
            className={cn(
              "rounded-full px-3 py-1.5 text-caption font-medium",
              categoryFilter === filter ? "bg-primary text-ink-inverse" : "bg-canvas text-ink hover:bg-border",
              focusRing,
            )}
          >
            {t(`filter.${filter}`)}
          </button>
        ))}
      </div>

      {postsError ? (
        <ErrorState description={postsError} onRetry={onRetry} />
      ) : loadingPosts && posts.length === 0 ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-card border border-border bg-surface p-4">
              <Skeleton lines={3} />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-card border border-dashed border-border">
          <EmptyState title={t("feed.empty")} description={t("feed.emptyDetail")} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
      )}

      {canLoadMore ? (
        <Button variant="secondary" fullWidth loading={loadingPosts} onClick={onLoadMore}>
          {t("feed.loadMore")}
        </Button>
      ) : null}
    </div>
  );
};

export default PublicDiscussionFeed;
