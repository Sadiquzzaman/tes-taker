"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import useAttachmentUploads from "@/component/Classes/discussions/useAttachmentUploads";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, ErrorState, Skeleton, Switch, Textarea } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import { getStoredUser } from "@/lib/authSession";
import axiosReq from "@/lib/axios";
import type { ChatListener } from "./ChatPage";
import ReportButton from "./ReportButton";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;
const PAGE = 30;

type Listen = (listener: ChatListener) => () => void;

/**
 * One group chat (COM-01): the rule notice, pinned posts, a composer and the posts newest first
 * with "Load older"; each post opens its comment thread. Teachers pin, delete any message and
 * turn on "Only teachers can post"; everyone replies, deletes their own and mutes the group.
 */
const GroupChat = ({ groupId, classId, onBack, listen }: { groupId: string; classId: string; onBack: () => void; listen: Listen }) => {
  const t = useTranslations("chat");
  const { activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const path = `/chat/groups/${groupId}`;
  const { data: group, failed, reload: reloadGroup, setData: setGroup } = useApiData<ChatGroupDetail>(path);
  const { data: posts, setData: setPosts } = useApiData<ChatMessage[]>(`${path}/messages`);
  const [more, setMore] = useState(true);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const postsRef = useRef<ChatMessage[] | null>(null);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Opening the group (and every message heard while it is open) marks it read.
  const markRead = useRef(() => void axiosReq.post(`${BASE}${path}/read`).catch(() => undefined));
  useEffect(() => {
    markRead.current();
  }, []);

  useEffect(
    () =>
      listen((event) => {
        const list = postsRef.current;
        if (event.type === "message" && event.message.group_id === groupId) {
          markRead.current();
          const { message } = event;
          if (!list) return;
          if (!message.parent_id) {
            if (!list.some((p) => p.id === message.id)) setPosts([message, ...list]);
          } else {
            setPosts(list.map((p) => (p.id === message.parent_id ? { ...p, comment_count: p.comment_count + 1, last_comment_at: message.created_at } : p)));
          }
        }
        if (event.type === "deleted" && event.group_id === groupId && list) {
          setPosts(
            list.map((p) =>
              p.id === event.id ? { ...p, deleted: true, content: "", attachments: [] } : p.id === event.parent_id ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p,
            ),
          );
        }
        if (event.type === "group" && event.group_id === groupId) reloadGroup();
      }),
    [groupId, listen, reloadGroup, setPosts],
  );

  const loadOlder = async () => {
    if (!posts?.length) return;
    const res = await axiosReq.get<{ payload: ChatMessage[] }>(`${BASE}${path}/messages`, { params: { before: posts[posts.length - 1].created_at, limit: PAGE } });
    const older = res.data.payload.filter((p) => !posts.some((q) => q.id === p.id));
    setPosts([...posts, ...older]);
    if (res.data.payload.length < PAGE) setMore(false);
  };

  const setting = async (url: string, body: Record<string, boolean>, apply: (g: ChatGroupDetail) => ChatGroupDetail) => {
    try {
      await axiosReq.request({ method: url.endsWith("/mute") ? "put" : "patch", url: `${BASE}${url}`, data: body });
      if (group) setGroup(apply(group));
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reloadGroup} />;
  if (!group) return <Card aria-busy="true"><Skeleton lines={5} /></Card>;
  const teacher = group.role === "TEACHER";
  const canPost = !group.read_only && (teacher || !group.announcement_only);

  return (
    <section aria-label={group.label} className="flex min-w-0 flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="mb-1 lg:hidden" onClick={onBack}>
              {t("back")}
            </Button>
            <h2 className="truncate text-body font-semibold text-ink">{group.label}</h2>
            <p className="text-caption text-ink-muted">{t("teachers", { names: group.teachers.map((x) => x.name).join(", ") || "—" })}</p>
          </div>
          <div className="flex flex-col gap-2">
            {teacher ? (
              <Switch
                label={t("announcementOnly")}
                hint={t("announcementOnlyHint")}
                checked={group.announcement_only}
                disabled={group.read_only}
                onChange={(on) => void setting(path, { announcement_only: on }, (g) => ({ ...g, announcement_only: on }))}
              />
            ) : null}
            <Switch label={t("mute")} hint={t("muteHint")} checked={group.muted} onChange={(on) => void setting(`${path}/mute`, { muted: on }, (g) => ({ ...g, muted: on }))} />
          </div>
        </div>
        <p role="note" className="mt-3 rounded-input bg-canvas px-3 py-2 text-caption text-ink-muted">
          {t("reviewNotice", { org: activeOrganization?.name ?? t("yourSchool") })}
        </p>
      </Card>

      {group.pinned.length ? (
        <Card title={t("pinned")}>
          <ul className="flex flex-col gap-2">
            {group.pinned.map((p) => (
              <li key={p.id} className="text-body-sm text-ink">
                <span className="font-medium">{p.author.name}:</span> {p.content || p.attachments.map((a) => a.name).join(", ")}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {group.read_only ? (
        <p className="text-body-sm text-ink-muted">{group.closed ? t("closedBySchool") : t("readOnly")}</p>
      ) : canPost ? (
        <Composer
          path={path}
          classId={classId}
          label={t("newPost")}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSent={(message) => {
            setReplyTo(null);
            if (posts && !message.parent_id && !posts.some((p) => p.id === message.id)) setPosts([message, ...posts]);
          }}
        />
      ) : (
        <p className="text-body-sm text-ink-muted">{t("teachersOnly")}</p>
      )}

      {!posts ? (
        <Skeleton lines={4} />
      ) : posts.length === 0 ? (
        <p className="text-body-sm text-ink-muted">{t("noMessages")}</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label={t("postsLabel")}>
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                group={group}
                path={path}
                classId={classId}
                listen={listen}
                onReply={(m) => setReplyTo(m)}
                onChanged={(changed) => setPosts(posts.map((p) => (p.id === changed.id ? changed : p)))}
                onPinned={() => reloadGroup()}
              />
            </li>
          ))}
        </ol>
      )}
      {posts && posts.length >= PAGE && more ? (
        <Button variant="secondary" className="self-center" onClick={() => void loadOlder()}>
          {t("loadOlder")}
        </Button>
      ) : null}
    </section>
  );
};

/** One message: author, time, quoted reply, text, files and its actions. */
export const MessageBody = ({ message, actions }: { message: ChatMessage; actions?: React.ReactNode }) => {
  const t = useTranslations("chat");
  const format = useFormat();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
        <span className="font-medium text-ink">{message.author.name}</span>
        {message.author.is_teacher ? <Badge tone="info">{t("teacher")}</Badge> : null}
        <time dateTime={message.created_at}>{format.date(message.created_at, { dateStyle: "medium", timeStyle: "short" })}</time>
        {message.pinned ? <Badge tone="neutral">{t("pinnedBadge")}</Badge> : null}
      </div>
      {message.reply_to ? (
        <blockquote className="border-l-2 border-border pl-2 text-caption text-ink-muted">
          {message.reply_to.deleted ? t("deleted") : `${message.reply_to.author_name}: ${message.reply_to.content}`}
        </blockquote>
      ) : null}
      {message.deleted ? (
        <p className="text-body-sm italic text-ink-muted">{t("deleted")}</p>
      ) : (
        <>
          {message.content ? <p className="whitespace-pre-wrap break-words text-body-sm text-ink">{message.content}</p> : null}
          {message.attachments.length ? (
            <ul className="flex flex-wrap gap-2">
              {message.attachments.map((a) => (
                <li key={a.file_id}>
                  <a href={`${BASE}${a.url}`} target="_blank" rel="noreferrer" className="text-body-sm text-primary underline">
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {actions && !message.deleted ? <div className="flex flex-wrap gap-1">{actions}</div> : null}
    </div>
  );
};

const PostCard = ({
  post,
  group,
  path,
  classId,
  listen,
  onReply,
  onChanged,
  onPinned,
}: {
  post: ChatMessage;
  group: ChatGroupDetail;
  path: string;
  classId: string;
  listen: Listen;
  onReply: (message: ChatMessage) => void;
  onChanged: (message: ChatMessage) => void;
  onPinned: () => void;
}) => {
  const t = useTranslations("chat");
  const { handleError } = useApiError();
  const [open, setOpen] = useState(false);
  const teacher = group.role === "TEACHER";
  const me = getStoredUser()?.id;

  const remove = async (message: ChatMessage, then: () => void) => {
    try {
      await axiosReq.delete(`${BASE}${path}/messages/${message.id}`);
      then();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };
  const pin = async () => {
    try {
      await axiosReq.put(`${BASE}${path}/messages/${post.id}/pin`, { pinned: !post.pinned });
      onChanged({ ...post, pinned: !post.pinned });
      onPinned();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };

  return (
    <Card>
      <MessageBody
        message={post}
        actions={
          <>
            {!group.read_only && (teacher || !group.announcement_only) ? (
              <Button variant="ghost" size="sm" onClick={() => onReply(post)}>
                {t("reply")}
              </Button>
            ) : null}
            {teacher && !group.read_only ? (
              <Button variant="ghost" size="sm" onClick={() => void pin()}>
                {post.pinned ? t("unpin") : t("pin")}
              </Button>
            ) : null}
            {(teacher || post.author.id === me) && !group.read_only ? (
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => void remove(post, () => onChanged({ ...post, deleted: true, content: "", attachments: [] }))}>
                {t("delete")}
              </Button>
            ) : null}
            {post.author.id !== me ? <ReportButton chatType="GROUP" chatId={group.id} message={post} /> : null}
          </>
        }
      />
      <Button variant="ghost" size="sm" className="mt-2" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t("comments", { count: post.comment_count })}
      </Button>
      {open ? <Thread post={post} group={group} path={path} classId={classId} listen={listen} onRemove={remove} /> : null}
    </Card>
  );
};

/** A post's comments, kept live, with a comment box. */
const Thread = ({
  post,
  group,
  path,
  classId,
  listen,
  onRemove,
}: {
  post: ChatMessage;
  group: ChatGroupDetail;
  path: string;
  classId: string;
  listen: Listen;
  onRemove: (message: ChatMessage, then: () => void) => Promise<void>;
}) => {
  const t = useTranslations("chat");
  const { data: comments, setData } = useApiData<ChatMessage[]>(`${path}/messages/${post.id}/comments`);
  const listRef = useRef<ChatMessage[] | null>(null);
  const me = getStoredUser()?.id;

  useEffect(() => {
    listRef.current = comments;
  }, [comments]);

  useEffect(
    () =>
      listen((event) => {
        const list = listRef.current;
        if (!list) return;
        if (event.type === "message" && event.message.parent_id === post.id && !list.some((c) => c.id === event.message.id)) setData([...list, event.message]);
        if (event.type === "deleted" && event.parent_id === post.id) setData(list.map((c) => (c.id === event.id ? { ...c, deleted: true, content: "", attachments: [] } : c)));
      }),
    [listen, post.id, setData],
  );

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
      {!comments ? (
        <Skeleton lines={2} />
      ) : (
        <ol className="flex flex-col gap-3" aria-label={t("commentsLabel")}>
          {comments.map((comment) => (
            <li key={comment.id} className="pl-3">
              <MessageBody
                message={comment}
                actions={
                  <>
                    {(group.role === "TEACHER" || comment.author.id === me) && !group.read_only ? (
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => void onRemove(comment, () => setData(comments.map((c) => (c.id === comment.id ? { ...c, deleted: true, content: "", attachments: [] } : c))))}>
                        {t("delete")}
                      </Button>
                    ) : null}
                    {comment.author.id !== me ? <ReportButton chatType="GROUP" chatId={group.id} message={comment} /> : null}
                  </>
                }
              />
            </li>
          ))}
        </ol>
      )}
      {!group.read_only ? (
        <Composer
          path={path}
          classId={classId}
          label={t("newComment")}
          parentId={post.id}
          onSent={(message) => {
            if (comments && !comments.some((c) => c.id === message.id)) setData([...comments, message]);
          }}
        />
      ) : null}
    </div>
  );
};

/** Text and files; a post, or a comment on `parentId`, optionally replying to a message. */
export const Composer = ({
  path,
  classId,
  label,
  parentId,
  replyTo,
  onCancelReply,
  onSent,
}: {
  path: string;
  /** The section's class, for file uploads; none = text only. */
  classId?: string;
  label: string;
  parentId?: string;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onSent: (message: ChatMessage) => void;
}) => {
  const t = useTranslations("chat");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { upload, uploading, status } = useAttachmentUploads(classId ?? "");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<DiscussionAttachment[]>([]);
  const [busy, setBusy] = useState(false);

  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    const result = await upload(Array.from(list));
    setFiles((current) => [...current, ...result.attachments].slice(0, 5));
    if (result.error) triggerToast({ title: result.error, type: "error" });
  };

  const send = async () => {
    setBusy(true);
    try {
      const res = await axiosReq.post<{ payload: ChatMessage }>(`${BASE}${path}/messages`, {
        content: text,
        file_ids: files.map((f) => f.id),
        ...(parentId ? { parent_id: parentId } : {}),
        ...(replyTo ? { reply_to_id: replyTo.id } : {}),
      });
      setText("");
      setFiles([]);
      onSent(res.data.payload);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {replyTo ? (
        <div className="flex items-center justify-between gap-2 rounded-input bg-canvas px-3 py-2 text-caption text-ink-muted">
          <span className="truncate">{t("replyingTo", { name: replyTo.author.name, text: replyTo.content })}</span>
          <Button variant="ghost" size="sm" onClick={onCancelReply}>
            {t("cancel")}
          </Button>
        </div>
      ) : null}
      <Textarea label={label} rows={parentId ? 2 : 3} maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} />
      {files.length ? (
        <ul className="flex flex-wrap gap-2 text-caption text-ink-muted" aria-label={t("attached")}>
          {files.map((f) => (
            <li key={f.id}>
              {f.file_name}{" "}
              <button type="button" className="text-danger underline" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>
                {t("removeFile")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {status ? <p className="text-caption text-ink-muted">{status}</p> : null}
      <div className="flex items-center justify-end gap-2">
        {classId ? (
          <label className="cursor-pointer text-body-sm text-primary underline">
            {t("attach")}
            <input type="file" multiple className="sr-only" onChange={(event) => void attach(event.target.files)} disabled={uploading || files.length >= 5} />
          </label>
        ) : null}
        <Button size="sm" loading={busy} disabled={uploading || (!text.trim() && files.length === 0)} onClick={() => void send()}>
          {t("send")}
        </Button>
      </div>
    </div>
  );
};

export default GroupChat;
