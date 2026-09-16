"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import DropDownComponent from "@/Ui/DropDownComponent";
import axiosReq from "@/lib/axios";
import { getStoredUser } from "@/lib/authSession";
import { useApiError } from "@/hooks/api/useApiError";
import { useToast } from "@/component/Toast/ToastContext";
import { getClassStudentDisplayName } from "@/utils/classes/classStudentDisplay";
import PublicDiscussionFeed from "./discussions/PublicDiscussionFeed";
import PrivateDiscussionPane from "./discussions/PrivateDiscussionPane";

const PAGE_LIMIT = 20;
const POLL_MS = 20000;

type Mode = "public" | "private";

const subjectLabel = (subject?: { name: string; code: string | null }) => {
  if (!subject?.name) return "Subject";
  return subject.code ? `${subject.name} — ${subject.code}` : subject.name;
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
  const currentUserId = getStoredUser()?.id;
  const isTeacher = role === "TEACHER";

  const [subjects, setSubjects] = useState<DiscussionSubjectOption[]>([]);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [mode, setMode] = useState<Mode>("public");
  const [categoryFilter, setCategoryFilter] = useState<DiscussionPostCategory | "all">("all");

  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [postsMeta, setPostsMeta] = useState<DiscussionPageMeta | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, DiscussionComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const [conversations, setConversations] = useState<DiscussionConversation[]>([]);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [startWithId, setStartWithId] = useState("");
  const [rosterStudents, setRosterStudents] = useState<ClassStudent[]>([]);

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

  const joinedStudents = useMemo(() => {
    const source =
      rosterStudents.length > 0
        ? rosterStudents
        : classStudents.filter((item): item is ClassStudent => "student_id" in item);

    return source.filter((item) => item.status === "JOINED" && Boolean(item.student_id));
  }, [classStudents, rosterStudents]);

  const startOptions = useMemo<DropDownOption[]>(() => {
    if (isTeacher) {
      return joinedStudents.map((student) => {
        const name = getClassStudentDisplayName(student);
        const phone = student.student?.phone?.trim();
        return {
          value: student.student_id,
          label: phone && phone !== name ? `${name} · ${phone}` : name,
        };
      });
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
    async (page = 1, append = false, category: DiscussionPostCategory | "all" = categoryFilter) => {
      if (!selectedSubjectId) return;
      setLoadingPosts(true);
      setPostsError(null);
      try {
        const categoryQuery = category !== "all" ? `&category=${category}` : "";
        const response = await axiosReq.get<ApiResponse<DiscussionListPayload<DiscussionPost>>>(
          `${scopedUrl("/discussions")}?page=${page}&limit=${PAGE_LIMIT}${categoryQuery}`,
        );
        const payload = response.data.payload;
        const items = (payload.items ?? []).map((post) => ({
          ...post,
          category: post.category || "general",
          attachments: post.attachments || [],
        }));
        setPosts((current) => (append ? [...current, ...items] : items));
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
    [categoryFilter, handleError, scopedUrl, selectedSubjectId],
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
        const items = (response.data.payload.items ?? []).map((message) => ({
          ...message,
          attachments: message.attachments || [],
        }));
        setMessages(items);
      } catch (error) {
        handleError(error as AxiosError<ApiError>);
        setMessages([]);
      }
    },
    [handleError, scopedUrl, selectedSubjectId],
  );

  const loadClassRoster = useCallback(async () => {
    if (!isTeacher || !classId) return;
    try {
      const response = await axiosReq.get<ApiResponse<ClassStudent[]>>(`${baseUrl}/classes/${classId}/students`);
      setRosterStudents(response.data.payload ?? []);
    } catch {
      setRosterStudents([]);
    }
  }, [baseUrl, classId, isTeacher]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    void loadClassRoster();
  }, [loadClassRoster]);

  useEffect(() => {
    if (!selectedSubjectId) return;
    if (mode === "public") {
      void loadPosts(1, false, categoryFilter);
    } else {
      void loadConversations();
    }
  }, [categoryFilter, loadConversations, loadPosts, mode, selectedSubjectId]);

  useEffect(() => {
    if (mode === "private" && activeConversationId) {
      void loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages, mode]);

  useEffect(() => {
    const refresh = () => {
      if (document.hidden || !selectedSubjectId) return;
      if (mode === "public") {
        void loadPosts(1, false, categoryFilter);
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
  }, [activeConversationId, categoryFilter, loadConversations, loadMessages, loadPosts, mode, selectedSubjectId]);

  const submitPost = async (payload: {
    content: string;
    category: DiscussionPostCategory;
    attachments: DiscussionAttachment[];
  }) => {
    if (!selectedSubjectId) return;
    setSubmittingPost(true);
    try {
      await axiosReq.post(scopedUrl("/discussions"), {
        content: payload.content,
        category: payload.category,
        attachments: payload.attachments,
      });
      triggerToast({
        title: "Posted",
        description: "Your post was added to the class discussion.",
        type: "success",
      });
      await loadPosts(1, false, categoryFilter);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSubmittingPost(false);
    }
  };

  const savePost = async (postId: string, content: string) => {
    await axiosReq.patch(scopedUrl(`/discussions/${postId}`), { content });
    await loadPosts(1, false, categoryFilter);
  };

  const deletePost = async (postId: string) => {
    try {
      await axiosReq.delete(scopedUrl(`/discussions/${postId}`));
      await loadPosts(1, false, categoryFilter);
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

  const toggleComments = async (postId: string) => {
    if (openComments[postId]) {
      setOpenComments((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
      return;
    }
    await loadComments(postId);
  };

  const submitComment = async (postId: string) => {
    const content = (commentDrafts[postId] || "").trim();
    if (!content) return;
    try {
      await axiosReq.post(scopedUrl(`/discussions/${postId}/comments`), { content });
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadComments(postId);
      await loadPosts(1, false, categoryFilter);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      await axiosReq.delete(scopedUrl(`/discussions/${postId}/comments/${commentId}`));
      await loadComments(postId);
      await loadPosts(1, false, categoryFilter);
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

  const sendMessage = async (payload: { content: string; attachments: DiscussionAttachment[] }) => {
    if (!activeConversationId) return;
    setSubmittingMessage(true);
    try {
      await axiosReq.post(scopedUrl(`/private-conversations/${activeConversationId}/messages`), {
        content: payload.content,
        attachments: payload.attachments,
      });
      await loadMessages(activeConversationId);
      await loadConversations();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSubmittingMessage(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[#101828]">{className}</p>
          <p className="text-[12px] text-[#667085]">Discussions are scoped by subject</p>
        </div>
        <div className="min-w-[220px]">
          <DropDownComponent
            list={subjectOptions}
            value={selectedSubjectId}
            handleChange={(value: string) => {
              setSelectedSubjectId(value);
              setOpenComments({});
              setActiveConversationId("");
              setMessages([]);
            }}
            placeholder={loadingSubjects ? "Loading subjects…" : "Select subject"}
          />
        </div>
      </div>

      {subjectsError ? <p className="text-[13px] text-[#B42318]">{subjectsError}</p> : null}

      <div className="inline-flex rounded-full bg-[#F2F4F7] p-1">
        <button
          type="button"
          onClick={() => setMode("public")}
          className={`rounded-full px-4 py-1.5 text-[13px] font-medium ${
            mode === "public" ? "bg-white text-[#49734F] shadow-sm" : "text-[#667085]"
          }`}
        >
          Class Discussion
        </button>
        <button
          type="button"
          onClick={() => setMode("private")}
          className={`rounded-full px-4 py-1.5 text-[13px] font-medium ${
            mode === "private" ? "bg-white text-[#49734F] shadow-sm" : "text-[#667085]"
          }`}
        >
          Private Discussion
        </button>
      </div>

      {!selectedSubjectId && !loadingSubjects ? (
        <p className="rounded-[12px] border border-dashed border-[#D0D5DD] px-4 py-8 text-center text-[13px] text-[#667085]">
          Select a subject to open discussions.
        </p>
      ) : null}

      {selectedSubjectId && mode === "public" ? (
        <PublicDiscussionFeed
          classId={classId}
          subjectTitle={subjectTitle}
          posts={posts}
          postsMeta={postsMeta}
          loadingPosts={loadingPosts}
          postsError={postsError}
          submitting={submittingPost}
          categoryFilter={categoryFilter}
          openComments={openComments}
          commentDrafts={commentDrafts}
          currentUserId={currentUserId}
          onCategoryFilterChange={(value) => setCategoryFilter(value)}
          onSubmitPost={submitPost}
          onLoadMore={() => {
            if (!postsMeta) return;
            void loadPosts(postsMeta.page + 1, true, categoryFilter);
          }}
          onToggleComments={(postId) => void toggleComments(postId)}
          onCommentDraftChange={(postId, value) =>
            setCommentDrafts((current) => ({ ...current, [postId]: value }))
          }
          onSubmitComment={(postId) => void submitComment(postId)}
          onEditPost={async (postId, content) => {
            try {
              await savePost(postId, content);
            } catch (error) {
              handleError(error as AxiosError<ApiError>);
            }
          }}
          onDeletePost={(postId) => void deletePost(postId)}
          onDeleteComment={(postId, commentId) => void deleteComment(postId, commentId)}
        />
      ) : null}

      {selectedSubjectId && mode === "private" ? (
        <PrivateDiscussionPane
          classId={classId}
          currentUserId={currentUserId}
          isTeacher={isTeacher}
          conversations={conversations}
          loadingConversations={loadingConversations}
          conversationsError={conversationsError}
          activeConversationId={activeConversationId}
          messages={messages}
          startOptions={startOptions}
          startWithId={startWithId}
          submitting={submittingMessage}
          onSelectConversation={setActiveConversationId}
          onStartWithChange={setStartWithId}
          onStartConversation={() => void startConversation()}
          onSendMessage={sendMessage}
        />
      ) : null}
    </div>
  );
};

export default ClassDiscussions;
