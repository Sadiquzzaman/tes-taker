"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/design/ui";
import { cn, focusRing } from "@/design/ui/cn";
import useChatSocket from "@/hooks/chat/useChatSocket";
import useFormat from "@/i18n/useFormat";
import { getStoredUser } from "@/lib/authSession";
import GroupChat from "./GroupChat";

export type ChatListener = (event: ChatSocketEvent) => void;

/**
 * Chat (P9-01, COM-01, COM-03): the group chats of the subject classes the person teaches or
 * takes, with unread counts, and the open group beside the list (below it on phones). Messages
 * arrive on the `/chat` socket; the open group hears them through `listen`.
 */
const ChatPage = () => {
  const t = useTranslations("chat");
  const format = useFormat();
  const params = useSearchParams();
  const me = getStoredUser()?.id ?? null;
  const { data: groups, failed, reload, setData } = useApiData<ChatGroupSummary[]>("/chat/groups");
  const [openId, setOpenId] = useState<string | null>(params.get("group"));
  const listeners = useRef(new Set<ChatListener>());

  const listen = useCallback((listener: ChatListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const onEvent = useCallback(
    (event: ChatSocketEvent) => {
      if (groups && event.type === "message") {
        const { message } = event;
        setData(
          groups.map((g) =>
            g.id === message.group_id
              ? {
                  ...g,
                  unread: message.author.id === me || g.id === openId ? g.unread : g.unread + 1,
                  last_message: { author_name: message.author.name, preview: message.content || message.attachments.map((a) => a.name).join(", "), created_at: message.created_at },
                }
              : g,
          ),
        );
      }
      if (groups && event.type === "group") {
        setData(groups.map((g) => (g.id === event.group_id ? { ...g, announcement_only: event.announcement_only } : g)));
      }
      listeners.current.forEach((listener) => listener(event));
    },
    [groups, me, openId, setData],
  );
  const { subscribe } = useChatSocket(onEvent);

  const open = (id: string) => {
    setOpenId(id);
    if (groups) setData(groups.map((g) => (g.id === id ? { ...g, unread: 0 } : g)));
    window.history.replaceState(null, "", `/chat?group=${id}`);
    subscribe();
  };
  const current = groups?.find((g) => g.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("description")} />
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !groups ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <nav aria-label={t("listLabel")} className={cn("flex flex-col gap-2", current && "hidden lg:flex")}>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => open(group.id)}
                aria-current={group.id === openId ? "true" : undefined}
                className={cn(
                  "flex flex-col gap-1 rounded-card border bg-surface p-3 text-left shadow-card",
                  group.id === openId ? "border-primary" : "border-border",
                  focusRing,
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-ink">
                    {group.section_label} · {group.subject.name}
                  </span>
                  {group.unread > 0 ? <Badge tone="info">{t("unread", { count: group.unread })}</Badge> : null}
                </span>
                <span className="truncate text-caption text-ink-muted">
                  {group.last_message ? `${group.last_message.author_name}: ${group.last_message.preview}` : t("noMessages")}
                </span>
                {group.last_message ? <span className="text-caption text-ink-muted">{format.date(group.last_message.created_at, { dateStyle: "medium", timeStyle: "short" })}</span> : null}
              </button>
            ))}
          </nav>
          {current ? (
            <GroupChat key={current.id} groupId={current.id} classId={current.class_id} onBack={() => setOpenId(null)} listen={listen} />
          ) : (
            <Card className="hidden lg:block">
              <EmptyState title={t("choose")} description={t("chooseHint")} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatPage;
