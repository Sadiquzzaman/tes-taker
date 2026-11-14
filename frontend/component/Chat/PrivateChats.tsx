"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { Badge, Button, Card, Combobox, EmptyState, ErrorState, Skeleton, Switch } from "@/design/ui";
import { cn, focusRing } from "@/design/ui/cn";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import { getStoredUser } from "@/lib/authSession";
import axiosReq from "@/lib/axios";
import type { ChatListener } from "./ChatPage";
import { Composer, MessageBody } from "./GroupChat";
import ReportButton from "./ReportButton";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;
type Listen = (listener: ChatListener) => () => void;

/**
 * Private chats (P9-02, COM-02): a student with the teachers who teach them, a teacher with their
 * students; each sees only the words for their own side (`as`). The list with unread counts, "New message" to pick a contact, and the open chat with
 * read receipts ("Seen").
 */
const PrivateChats = ({ initialId, listen, as }: { initialId: string | null; listen: Listen; as: "student" | "teacher" }) => {
  const t = useTranslations("chat");
  const format = useFormat();
  const { handleError } = useApiError();
  const me = getStoredUser()?.id ?? null;
  const { data: chats, failed, reload, setData } = useApiData<DirectChatSummary[]>("/chat/direct");
  const { data: contacts } = useApiData<DirectContact[]>("/chat/direct/contacts");
  const [openId, setOpenId] = useState<string | null>(initialId);
  const [picking, setPicking] = useState(false);
  const chatsRef = useRef<DirectChatSummary[] | null>(null);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(
    () =>
      listen((event) => {
        const list = chatsRef.current;
        if (!list) return;
        if (event.type === "message" && list.some((c) => c.id === event.message.group_id)) {
          const { message } = event;
          setData(
            list.map((c) =>
              c.id === message.group_id
                ? {
                    ...c,
                    unread: message.author.id === me || c.id === openId ? c.unread : c.unread + 1,
                    last_message: { author_name: message.author.name, preview: message.content || message.attachments.map((a) => a.name).join(", "), created_at: message.created_at },
                  }
                : c,
            ),
          );
        } else if (event.type === "message") {
          // A chat someone else just started with this person.
          reload();
        }
        if (event.type === "read" && event.user_id !== me) setData(list.map((c) => (c.id === event.chat_id ? { ...c, other_read_at: event.at } : c)));
      }),
    [listen, me, openId, reload, setData],
  );

  const start = async (userId: string | null) => {
    if (!userId) return;
    try {
      const res = await axiosReq.post<{ payload: DirectChatSummary }>(`${BASE}/chat/direct`, { user_id: userId });
      const chat = res.data.payload;
      setPicking(false);
      open(chat.id, chats && !chats.some((c) => c.id === chat.id) ? [chat, ...chats] : chats);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };

  const open = (id: string, list = chats) => {
    setOpenId(id);
    if (list) setData(list.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    window.history.replaceState(null, "", `/chat?direct=${id}`);
  };
  const current = chats?.find((c) => c.id === openId) ?? null;

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!chats) return <Card aria-busy="true"><Skeleton lines={4} /></Card>;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className={cn("flex flex-col gap-2", current && "hidden lg:flex")}>
        {picking ? (
          <Card>
            <Combobox
              label={t(`newMessageTo.${as}`)}
              placeholder={t(`pickPerson.${as}`)}
              options={(contacts ?? []).map((c) => ({ value: c.id, label: c.name, detail: c.via.join(", ") }))}
              value={null}
              onChange={(value) => void start(value)}
            />
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPicking(false)}>
              {t("cancel")}
            </Button>
          </Card>
        ) : (
          <Button variant="secondary" onClick={() => setPicking(true)} disabled={!contacts?.length}>
            {t("newMessage")}
          </Button>
        )}
        {chats.length === 0 ? (
          <Card>
            <EmptyState title={t("noPrivate")} description={t(`noPrivateHint.${as}`)} />
          </Card>
        ) : (
          <nav aria-label={t("privateListLabel")} className="flex flex-col gap-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => open(chat.id)}
                aria-current={chat.id === openId ? "true" : undefined}
                className={cn("flex flex-col gap-1 rounded-card border bg-surface p-3 text-left shadow-card", chat.id === openId ? "border-primary" : "border-border", focusRing)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-ink">{chat.other.name}</span>
                  {chat.unread > 0 ? <Badge tone="info">{t("unread", { count: chat.unread })}</Badge> : null}
                </span>
                <span className="truncate text-caption text-ink-muted">
                  {chat.last_message ? `${chat.last_message.author_name}: ${chat.last_message.preview}` : t("noMessages")}
                </span>
                {chat.last_message ? <span className="text-caption text-ink-muted">{format.date(chat.last_message.created_at, { dateStyle: "medium", timeStyle: "short" })}</span> : null}
              </button>
            ))}
          </nav>
        )}
      </div>
      {current ? (
        <DirectChatView
          key={current.id}
          chat={current}
          listen={listen}
          onBack={() => setOpenId(null)}
          onMuted={(muted) => setData(chats.map((c) => (c.id === current.id ? { ...c, muted } : c)))}
        />
      ) : (
        <Card className="hidden lg:block">
          <EmptyState title={t("choosePrivate")} description={t("choosePrivateHint")} />
        </Card>
      )}
    </div>
  );
};

/** One private chat: messages oldest first, "Seen" under your last message once the other person read it. */
const DirectChatView = ({ chat, listen, onBack, onMuted }: { chat: DirectChatSummary; listen: Listen; onBack: () => void; onMuted: (muted: boolean) => void }) => {
  const t = useTranslations("chat");
  const format = useFormat();
  const { activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const me = getStoredUser()?.id ?? null;
  const path = `/chat/direct/${chat.id}`;
  const { data: newestFirst, setData } = useApiData<ChatMessage[]>(`${path}/messages`);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const listRef = useRef<ChatMessage[] | null>(null);
  const markRead = useRef(() => void axiosReq.post(`${BASE}${path}/read`).catch(() => undefined));

  useEffect(() => {
    listRef.current = newestFirst;
  }, [newestFirst]);
  useEffect(() => {
    markRead.current();
  }, []);

  useEffect(
    () =>
      listen((event) => {
        const list = listRef.current;
        if (event.type === "message" && event.message.group_id === chat.id) {
          markRead.current();
          if (list && !list.some((m) => m.id === event.message.id)) setData([event.message, ...list]);
        }
        if (event.type === "deleted" && event.group_id === chat.id && list) setData(list.map((m) => (m.id === event.id ? { ...m, deleted: true, content: "", attachments: [] } : m)));
      }),
    [chat.id, listen, setData],
  );

  const remove = async (message: ChatMessage) => {
    try {
      await axiosReq.delete(`${BASE}${path}/messages/${message.id}`);
      if (newestFirst) setData(newestFirst.map((m) => (m.id === message.id ? { ...m, deleted: true, content: "", attachments: [] } : m)));
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };
  const mute = async (muted: boolean) => {
    try {
      await axiosReq.put(`${BASE}${path}/mute`, { muted });
      onMuted(muted);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };

  const messages = newestFirst ? [...newestFirst].reverse() : null;
  const lastMine = messages?.filter((m) => m.author.id === me).at(-1);
  const seen = Boolean(lastMine && chat.other_read_at && Date.parse(chat.other_read_at) >= Date.parse(lastMine.created_at));

  return (
    <section aria-label={chat.other.name} className="flex min-w-0 flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="mb-1 lg:hidden" onClick={onBack}>
              {t("back")}
            </Button>
            <h2 className="truncate text-body font-semibold text-ink">{chat.other.name}</h2>
            <p className="text-caption text-ink-muted">{chat.other.is_teacher ? t("teacher") : t("student")}</p>
          </div>
          <Switch label={t("mute")} hint={t("muteHint")} checked={chat.muted} onChange={(on) => void mute(on)} />
        </div>
        <p role="note" className="mt-3 rounded-input bg-canvas px-3 py-2 text-caption text-ink-muted">
          {t("reviewNotice", { org: activeOrganization?.name ?? t("yourSchool") })}
        </p>
      </Card>
      {!messages ? (
        <Skeleton lines={4} />
      ) : messages.length === 0 ? (
        <p className="text-body-sm text-ink-muted">{t("noMessages")}</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label={t("messagesLabel")}>
          {messages.map((message) => (
            <li key={message.id} className={cn("max-w-[85%] rounded-card border border-border p-3", message.author.id === me ? "self-end bg-primary-soft" : "self-start bg-surface")}>
              <MessageBody
                message={message}
                actions={
                  message.author.id === me ? (
                    !chat.closed ? (
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => void remove(message)}>
                        {t("delete")}
                      </Button>
                    ) : null
                  ) : (
                    <>
                      {!chat.closed ? (
                        <Button variant="ghost" size="sm" onClick={() => setReplyTo(message)}>
                          {t("reply")}
                        </Button>
                      ) : null}
                      <ReportButton chatType="DIRECT" chatId={chat.id} message={message} />
                    </>
                  )
                }
              />
              {message.id === lastMine?.id && seen ? <p className="mt-1 text-right text-caption text-ink-muted">{t("seen", { time: format.date(chat.other_read_at!, { timeStyle: "short" }) })}</p> : null}
            </li>
          ))}
        </ol>
      )}
      {chat.closed ? (
        <p className="text-body-sm text-ink-muted">{t("closedBySchool")}</p>
      ) : (
        <Composer
          path={path}
          label={t("message")}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSent={(message) => {
            setReplyTo(null);
            if (newestFirst && !newestFirst.some((m) => m.id === message.id)) setData([message, ...newestFirst]);
          }}
        />
      )}
    </section>
  );
};

export default PrivateChats;
