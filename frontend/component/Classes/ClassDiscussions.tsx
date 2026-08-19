"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import DropDownComponent from "@/Ui/DropDownComponent";
import axiosReq from "@/lib/axios";
import { getStoredUser } from "@/lib/authSession";
import { useApiError } from "@/hooks/api/useApiError";
import { useToast } from "@/component/Toast/ToastContext";
import useWorkspace from "@/hooks/organization/useWorkspace";

const PAGE_LIMIT = 20;
const POLL_MS = 20000;

type Mode = "public" | "private";

const subjectLabel = (subject?: { name: string; code: string | null }) => {
  if (!subject?.name) return "Subject";
  return subject.code ? `${subject.name} — ${subject.code}` : subject.name;
};

const formatTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const ClassDiscussions = ({
  classId,
  className,
  role,
  classStudents,
}: {
  classId: string;
  className: string;
  role: RoleUserType | undefined;
  classStudents: ClassDetailsStudentItem[];
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const { isIndividual } = useWorkspace();
  const currentUserId = getStoredUser()?.id;
  const isTeacher = role === "TEACHER";

  const [subjects, setSubjects] = useState<DiscussionSubjectOption[]>([]);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [mode, setMode] = useState<Mode>("public");

  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [postsMeta, setPostsMeta] = useState<DiscussionPageMeta | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState("");
  const [openComments, setOpenComments] = useState<Record<string, DiscussionComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");

  const [conversations, setConversations] = useState<DiscussionConversation[]>([]);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [startWithId, setStartWithId] = useState("");

  const selectedSubject = subjects.find((item) => item.id === selectedSubjectId);
  const subjectTitle = selectedSubject ? subjectLabel(selectedSubject.class_subject.subject) : "";

  const subjectOptions = useMemo<DropDownOption[]>(
    () =>
      subjects.map((item) => ({
        value: item.id,
        label: subjectLabel(item.class_subject.subject),
      })),
    [subjects],
  );

  const joinedStudents = useMemo(
    () =>
      classStudents.filter((item): item is ClassStudent => "student_id" in item && item.status === "JOINED"),
    [classStudents],
  );

  const startOptions = useMemo<DropDownOption[]>(() => {
    if (isTeacher) {
      return joinedStudents
        .filter((student) => student.student_id)
        .map((student) => ({
          value: student.student_id,
          label: student.student?.full_name?.trim() || "Student",
        }));
    }
    return (selectedSubject?.teachers ?? []).map((teacher) => ({
      value: teacher.id,
      label: teacher.name,
    }));
  }, [isTeacher, joinedStudents, selectedSubject]);

  const scopedUrl = useCallback(
    (path: string) => `${baseUrl}/classes/${classId}/subjects/${selectedSubjectId}${path}`,
    [baseUrl, classId, selectedSubjectId],
  );

  const loadSubjects = useCallback(async () => {
    if (!classId) return;
    setLoadingSubjects(true);
    setSubjectsError(null);
    try {
      const response = await axiosReq.get<ApiResponse<DiscussionSubjectOption[]>>(
        `${baseUrl}/classes/${classId}/discussion-subjects`,
      );
      const next = response.data.payload ?? [];
      setSubjects(next);
      setSelectedSubjectId((current) => current || next[0]?.id || "");
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      handleError(axiosError);
      setSubjects([]);
      setSubjectsError(
        axiosError.response?.status === 403
          ? "You do not have access to discussions for this class."
          : "Unable to load discussion subjects.",
      );
    } finally {
      setLoadingSubjects(false);
    }
  }, [baseUrl, classId, handleError]);

  const loadPosts = useCallback(
    async (page = 1, append = false) => {
      if (!selectedSubjectId) return;
      setLoadingPosts(true);
      setPostsError(null);
      try {
        const response = await axiosReq.get<ApiResponse<DiscussionListPayload<DiscussionPost>>>(
          `${scopedUrl("/discussions")}?page=${page}&limit=${PAGE_LIMIT}`,
        );
        const payload = response.data.payload;
        setPosts((current) => (append ? [...current, ...(payload.items ?? [])] : payload.items ?? []));
        setPostsMeta(payload.meta);
      } catch (error) {
        const axiosError = error as AxiosError<ApiError>;
        handleError(axiosError);
        if (!append) setPosts([]);
        setPostsError(
          axiosError.response?.status === 403
            ? "You do not have access to this subject discussion."
            : "Unable to load class discussion.",
        );
      } finally {
        setLoadingPosts(false);
      }
    },
    [handleError, scopedUrl, selectedSubjectId],
  );

  const loadConversations = useCallback(async () => {
    if (!selectedSubjectId) return;
    setLoadingConversations(true);
    setConversationsError(null);
    try {
      const response = await axiosReq.get<ApiResponse<DiscussionConversation[]>>(
        scopedUrl("/private-conversations"),
      );
      const next = response.data.payload ?? [];
      setConversations(next);
      setActiveConversationId((current) =>
        next.some((conversation) => conversation.id === current) ? current : next[0]?.id || "",
      );
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      handleError(axiosError);
      setConversations([]);
      setConversationsError(
        axiosError.response?.status === 403
          ? "You do not have access to private conversations for this subject."
          : "Unable to load private conversations.",
      );
    } finally {
      setLoadingConversations(false);
    }
  }, [handleError, scopedUrl, selectedSubjectId]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!selectedSubjectId || !conversationId) return;
      try {
        const response = await axiosReq.get<ApiResponse<DiscussionListPayload<DiscussionMessage>>>(
          `${scopedUrl(`/private-conversations/${conversationId}/messages`)}?page=1&limit=${PAGE_LIMIT}`,
        );
        setMessages(response.data.payload.items ?? []);
      } catch (error) {
        handleError(error as AxiosError<ApiError>);
        setMessages([]);
      }
    },
    [handleError, scopedUrl, selectedSubjectId],
  );

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    if (!selectedSubjectId) return;
    if (mode === "public") {
      void loadPosts(1, false);
    } else {
      void loadConversations();
    }
  }, [loadConversations, loadPosts, mode, selectedSubjectId]);

  useEffect(() => {
    if (mode === "private" && activeConversationId) {
      void loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages, mode]);

  useEffect(() => {
    const refresh = () => {
      if (document.hidden || !selectedSubjectId) return;
      if (mode === "public") {
        void loadPosts(1, false);
      } else {
        void loadConversations();
        if (activeConversationId) void loadMessages(activeConversationId);
      }
    };

    const intervalId = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [activeConversationId, loadConversations, loadMessages, loadPosts, mode, selectedSubjectId]);

  const submitPost = async () => {
    const content = postContent.trim();
    if (!content || !selectedSubjectId) return;
    try {
      await axiosReq.post(scopedUrl("/discussions"), { content });
      setPostContent("");
      triggerToast({ title: "Posted", description: "Your question was added to the class discussion.", type: "success" });
      await loadPosts(1, false);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const savePost = async (postId: string) => {
    const content = editingPostContent.trim();
    if (!content) return;
    try {
      await axiosReq.patch(scopedUrl(`/discussions/${postId}`), { content });
      setEditingPostId(null);
      await loadPosts(1, false);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await axiosReq.delete(scopedUrl(`/discussions/${postId}`));
      await loadPosts(1, false);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const response = await axiosReq.get<ApiResponse<DiscussionListPayload<DiscussionComment>>>(
        `${scopedUrl(`/discussions/${postId}/comments`)}?page=1&limit=${PAGE_LIMIT}`,
      );
      setOpenComments((current) => ({ ...current, [postId]: response.data.payload.items ?? [] }));
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const submitComment = async (postId: string) => {
    const content = (commentDrafts[postId] || "").trim();
    if (!content) return;
    try {
      await axiosReq.post(scopedUrl(`/discussions/${postId}/comments`), { content });
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadComments(postId);
      await loadPosts(1, false);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      await axiosReq.delete(scopedUrl(`/discussions/${postId}/comments/${commentId}`));
      setEditingCommentId(null);
      await loadComments(postId);
      await loadPosts(1, false);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const saveComment = async (postId: string, commentId: string) => {
    const content = editingCommentContent.trim();
    if (!content) return;
    try {
      await axiosReq.patch(scopedUrl(`/discussions/${postId}/comments/${commentId}`), { content });
      setEditingCommentId(null);
      await loadComments(postId);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const startConversation = async () => {
    if (!startWithId || !selectedSubjectId) return;
    try {
      const body = isTeacher ? { student_id: startWithId } : { teacher_id: startWithId };
      const response = await axiosReq.post<ApiResponse<DiscussionConversation>>(
        scopedUrl("/private-conversations"),
        body,
      );
      const conversation = response.data.payload;
      setStartWithId("");
      await loadConversations();
      if (conversation?.id) {
        setActiveConversationId(conversation.id);
      }
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const sendMessage = async () => {
    const content = messageContent.trim();
    if (!content || !activeConversationId) return;
    try {
      await axiosReq.post(scopedUrl(`/private-conversations/${activeConversationId}/messages`), { content });
      setMessageContent("");
      await loadMessages(activeConversationId);
      await loadConversations();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  if (loadingSubjects) {
    return <p className="p-4 text-sm text-[#747775]">Loading discussions...</p>;
  }

  if (subjectsError) {
    return <p className="p-4 text-sm text-[#D14343]">{subjectsError}</p>;
  }

  if (subjects.length === 0) {
    return (
      <p className="p-4 text-sm text-[#747775]">
        No subjects are available for discussion yet. Teachers must be assigned to a class subject before Q&amp;A
        appears here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-[18px] font-[600] text-[#232A25]">{className}</p>
        <p className="text-sm text-[#747775]">
          {isIndividual ? "Subject" : "Organization Subject"}
          {subjectTitle ? `: ${subjectTitle}` : ""}
        </p>
      </div>

      <div className="max-w-md">
        <DropDownComponent
          value={selectedSubjectId}
          handleChange={setSelectedSubjectId}
          list={subjectOptions}
          placeholder="Select subject"
          isSearchable
        />
      </div>

      <div className="flex w-fit rounded-md bg-gray-100 p-0.5">
        <button
          className={`px-4 py-2 text-sm rounded ${mode === "public" ? "bg-white shadow text-[#232A25]" : "text-[#747775]"}`}
          onClick={() => setMode("public")}
        >
          Class discussion
        </button>
        <button
          className={`px-4 py-2 text-sm rounded ${mode === "private" ? "bg-white shadow text-[#232A25]" : "text-[#747775]"}`}
          onClick={() => setMode("private")}
        >
          Private
        </button>
      </div>

      {mode === "public" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[8px] border border-[#E5E5E5] p-4 flex flex-col gap-3">
            <textarea
              value={postContent}
              onChange={(event) => setPostContent(event.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="Ask a question or share a note for this subject"
              className="w-full resize-y rounded-[8px] border border-[#E5E5E5] p-3 text-sm text-[#232A25]"
            />
            <button
              onClick={() => void submitPost()}
              className="self-end rounded-xl bg-[#49734F] px-4 py-2 text-sm font-[500] text-white"
            >
              Post
            </button>
          </div>

          {postsError && <p className="text-sm text-[#D14343]">{postsError}</p>}
          {loadingPosts && posts.length === 0 && <p className="text-sm text-[#747775]">Loading posts...</p>}
          {!loadingPosts && !postsError && posts.length === 0 && (
            <p className="text-sm text-[#747775]">No posts yet for this subject.</p>
          )}

          {posts.map((post) => (
            <div key={post.id} className="rounded-[8px] border border-[#E5E5E5] p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-[600] text-[#232A25]">{post.author.name}</p>
                  <p className="text-xs text-[#747775]">{formatTime(post.created_at)}</p>
                </div>
                {post.author.id === currentUserId && (
                  <div className="flex gap-2 text-sm">
                    <button
                      className="text-[#49734F]"
                      onClick={() => {
                        setEditingPostId(post.id);
                        setEditingPostContent(post.content);
                      }}
                    >
                      Edit
                    </button>
                    <button className="text-[#D14343]" onClick={() => void deletePost(post.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {editingPostId === post.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editingPostContent}
                    onChange={(event) => setEditingPostContent(event.target.value)}
                    maxLength={4000}
                    rows={3}
                    className="w-full rounded-[8px] border border-[#E5E5E5] p-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <button className="rounded-xl bg-[#49734F] px-3 py-1 text-sm text-white" onClick={() => void savePost(post.id)}>
                      Save
                    </button>
                    <button className="text-sm text-[#747775]" onClick={() => setEditingPostId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-[#232A25]">{post.content}</p>
              )}

              <button
                className="self-start text-sm text-[#49734F]"
                onClick={() => void loadComments(post.id)}
              >
                Comments ({post.comments_count})
              </button>

              {openComments[post.id] && (
                <div className="flex flex-col gap-3 border-t border-[#E5E5E5] pt-3">
                  {openComments[post.id].map((comment) => (
                    <div key={comment.id} className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-[600] text-[#232A25]">{comment.author.name}</p>
                        {editingCommentId === comment.id ? (
                          <div className="mt-1 flex flex-col gap-2">
                            <textarea
                              value={editingCommentContent}
                              onChange={(event) => setEditingCommentContent(event.target.value)}
                              maxLength={2000}
                              rows={2}
                              className="w-full rounded-[8px] border border-[#E5E5E5] p-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                className="text-xs text-[#49734F]"
                                onClick={() => void saveComment(post.id, comment.id)}
                              >
                                Save
                              </button>
                              <button className="text-xs text-[#747775]" onClick={() => setEditingCommentId(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-[#232A25]">{comment.content}</p>
                        )}
                      </div>
                      {comment.author.id === currentUserId && editingCommentId !== comment.id && (
                        <div className="flex gap-2">
                          <button
                            className="text-xs text-[#49734F]"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentContent(comment.content);
                            }}
                          >
                            Edit
                          </button>
                          <button className="text-xs text-[#D14343]" onClick={() => void deleteComment(post.id, comment.id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={commentDrafts[post.id] || ""}
                      onChange={(event) =>
                        setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))
                      }
                      maxLength={2000}
                      placeholder="Write a comment"
                      className="flex-1 rounded-[8px] border border-[#E5E5E5] px-3 py-2 text-sm"
                    />
                    <button
                      className="rounded-xl bg-[#49734F] px-3 py-2 text-sm text-white"
                      onClick={() => void submitComment(post.id)}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {postsMeta && postsMeta.page < postsMeta.total_pages && (
            <button
              className="self-center text-sm text-[#49734F]"
              onClick={() => void loadPosts((postsMeta.page || 1) + 1, true)}
            >
              Load more
            </button>
          )}
        </div>
      )}

      {mode === "private" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
          <div className="flex flex-col gap-3 rounded-[8px] border border-[#E5E5E5] p-3">
            <div className="flex flex-col gap-2">
              <DropDownComponent
                value={startWithId}
                handleChange={setStartWithId}
                list={startOptions}
                placeholder={isTeacher ? "Start with a student" : "Start with a teacher"}
                isSearchable
              />
              <button
                className="rounded-xl bg-[#49734F] px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={!startWithId}
                onClick={() => void startConversation()}
              >
                Start conversation
              </button>
            </div>
            {conversationsError && <p className="text-sm text-[#D14343]">{conversationsError}</p>}
            {loadingConversations && conversations.length === 0 && (
              <p className="text-sm text-[#747775]">Loading conversations...</p>
            )}
            {!loadingConversations && !conversationsError && conversations.length === 0 && (
              <p className="text-sm text-[#747775]">No private conversations yet.</p>
            )}
            {conversations.map((conversation) => {
              const other = isTeacher ? conversation.student : conversation.teacher;
              return (
                <button
                  key={conversation.id}
                  className={`rounded-[8px] px-3 py-2 text-left text-sm ${
                    activeConversationId === conversation.id ? "bg-[#49734F0D] text-[#232A25]" : "text-[#747775]"
                  }`}
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  {other.name}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-[320px] flex-col gap-3 rounded-[8px] border border-[#E5E5E5] p-4">
            {!activeConversationId ? (
              <p className="text-sm text-[#747775]">Select or start a private conversation.</p>
            ) : (
              <>
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                  {messages.map((message) => (
                    <div key={message.id} className="rounded-[8px] bg-[#F7F7F8] p-3">
                      <p className="text-xs font-[600] text-[#232A25]">{message.sender.name}</p>
                      <p className="whitespace-pre-wrap text-sm text-[#232A25]">{message.content}</p>
                      <p className="text-xs text-[#747775]">{formatTime(message.created_at)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={messageContent}
                    onChange={(event) => setMessageContent(event.target.value)}
                    maxLength={4000}
                    rows={2}
                    placeholder="Write a private message"
                    className="flex-1 rounded-[8px] border border-[#E5E5E5] p-3 text-sm"
                  />
                  <button className="self-end rounded-xl bg-[#49734F] px-4 py-2 text-sm text-white" onClick={() => void sendMessage()}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassDiscussions;
