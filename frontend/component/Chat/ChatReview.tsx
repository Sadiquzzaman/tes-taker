"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, Drawer, EmptyState, ErrorState, Modal, PageHeader, Select, Skeleton, Switch, Table, Tabs, Textarea, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { MessageBody } from "./GroupChat";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;
const MUTE_HOURS = [1, 24, 72, 168, 720];

/**
 * Reviewing chats (P9-02, COM-04, COM-05), for owners and admins. Chats: every chat by name;
 * opening one asks for a reason (logged), then its messages show with delete, mute the author for
 * a while, and close or reopen the chat. Reports: what members reported, with the messages around
 * it; keep or delete. Access log (the owner): who opened which chat, when and why.
 */
const ChatReview = () => {
  const t = useTranslations("chatReview");
  const params = useSearchParams();
  const { memberRole } = useWorkspace();
  const [tab, setTab] = useState(params.get("tab") === "reports" ? "reports" : "chats");

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs
        selectedKey={tab}
        onChange={setTab}
        tabs={[
          { key: "chats", label: t("chats"), content: <div className="pt-4"><ChatsTab /></div> },
          { key: "reports", label: t("reports"), content: <div className="pt-4"><ReportsTab /></div> },
          ...(memberRole === "OWNER" ? [{ key: "log", label: t("accessLog"), content: <div className="pt-4"><AccessLogTab /></div> }] : []),
        ]}
      />
    </div>
  );
};

const ChatsTab = () => {
  const t = useTranslations("chatReview");
  const format = useFormat();
  const { handleError } = useApiError();
  const { data: chats, failed, reload, setData } = useApiData<AdminChat[]>("/chat/admin/chats");
  const [asking, setAsking] = useState<AdminChat | null>(null);
  const [reason, setReason] = useState("");
  const [opened, setOpened] = useState<{ chat: AdminChat; messages: ChatMessage[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const openChat = async () => {
    if (!asking) return;
    setBusy(true);
    try {
      const res = await axiosReq.post<{ payload: { chat: AdminChat; messages: ChatMessage[] } }>(`${BASE}/chat/admin/chats/${asking.type}/${asking.id}/open`, { reason });
      setOpened(res.data.payload);
      setAsking(null);
      setReason("");
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<AdminChat>[] = [
    { key: "label", header: t("chat"), cell: (c) => <span className="font-medium text-ink">{c.label}</span>, sortValue: (c) => c.label },
    { key: "type", header: t("type"), cell: (c) => t(`types.${c.type}`), sortValue: (c) => c.type },
    { key: "state", header: t("state"), cell: (c) => (c.closed ? <Badge tone="danger">{t("closed")}</Badge> : <Badge tone="success">{t("open")}</Badge>) },
    {
      key: "activity",
      header: t("lastActivity"),
      cell: (c) => (c.last_activity ? format.date(c.last_activity, { dateStyle: "medium", timeStyle: "short" }) : "—"),
      sortValue: (c) => (c.last_activity ? new Date(c.last_activity) : null),
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (c) => (
        <Button size="sm" variant="secondary" onClick={() => setAsking(c)} aria-label={t("openFor", { chat: c.label })}>
          {t("openChat")}
        </Button>
      ),
    },
  ];

  if (failed !== null) return <ErrorState title={failed === 403 ? t("notAllowed") : t("loadFailed")} onRetry={reload} />;
  if (!chats) return <Card aria-busy="true"><Skeleton lines={4} /></Card>;

  return (
    <>
      <Table caption={t("chatsCaption")} columns={columns} rows={chats} getRowId={(c) => `${c.type}:${c.id}`} empty={<EmptyState title={t("noChats")} />} />
      <Modal
        open={Boolean(asking)}
        onClose={() => setAsking(null)}
        title={t("reasonTitle", { chat: asking?.label ?? "" })}
        description={t("reasonDetail")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(null)}>
              {t("cancel")}
            </Button>
            <Button loading={busy} disabled={!reason.trim()} onClick={() => void openChat()}>
              {t("openChat")}
            </Button>
          </>
        }
      >
        <Textarea label={t("reason")} rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Modal>
      <Drawer open={Boolean(opened)} onClose={() => setOpened(null)} title={opened?.chat.label ?? ""} description={t("readingNote")}>
        {opened ? (
          <OpenedChat
            key={opened.chat.id}
            chat={opened.chat}
            messages={opened.messages}
            onClosed={(closed) => {
              setOpened({ ...opened, chat: { ...opened.chat, closed } });
              setData(chats.map((c) => (c.id === opened.chat.id ? { ...c, closed } : c)));
            }}
          />
        ) : null}
      </Drawer>
    </>
  );
};

/** A chat opened with a reason: its messages (newest first) with delete and mute, and close/reopen. */
const OpenedChat = ({ chat, messages: initial, onClosed }: { chat: AdminChat; messages: ChatMessage[]; onClosed: (closed: boolean) => void }) => {
  const t = useTranslations("chatReview");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [messages, setMessages] = useState(initial);
  const [muting, setMuting] = useState<ChatMessage | null>(null);
  const [hours, setHours] = useState("24");
  const [why, setWhy] = useState("");
  const path = `${BASE}/chat/admin/chats/${chat.type}/${chat.id}`;

  const act = async (run: () => Promise<unknown>, done: string) => {
    try {
      await run();
      triggerToast({ title: done, type: "success" });
      return true;
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
      return false;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Switch
        label={t("closeChat")}
        hint={t("closeChatHint")}
        checked={chat.closed}
        onChange={(closed) => void act(() => axiosReq.put(`${path}/closed`, { closed }), closed ? t("closedDone") : t("reopenedDone")).then((ok) => ok && onClosed(closed))}
      />
      {messages.length === 0 ? (
        <p className="text-body-sm text-ink-muted">{t("noMessages")}</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label={t("messages")}>
          {messages.map((m) => (
            <li key={m.id} className="rounded-card border border-border p-3">
              <MessageBody
                message={m}
                actions={
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() =>
                        void act(() => axiosReq.delete(`${path}/messages/${m.id}`), t("deletedDone")).then(
                          (ok) => ok && setMessages(messages.map((x) => (x.id === m.id ? { ...x, deleted: true, content: "", attachments: [] } : x))),
                        )
                      }
                    >
                      {t("delete")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMuting(m)}>
                      {t("muteAuthor", { name: m.author.name })}
                    </Button>
                  </>
                }
              />
            </li>
          ))}
        </ol>
      )}
      <Modal
        open={Boolean(muting)}
        onClose={() => setMuting(null)}
        title={t("muteTitle", { name: muting?.author.name ?? "" })}
        description={t("muteDetail")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMuting(null)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() =>
                muting &&
                void act(() => axiosReq.post(`${path}/mutes`, { user_id: muting.author.id, hours: Number(hours), reason: why }), t("mutedDone")).then((ok) => {
                  if (ok) {
                    setMuting(null);
                    setWhy("");
                  }
                })
              }
            >
              {t("mute")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select label={t("muteFor")} placeholder={false} value={hours} onChange={(event) => setHours(event.target.value)} options={MUTE_HOURS.map((h) => ({ value: String(h), label: t("hours", { count: h }) }))} />
          <Textarea label={t("reasonOptional")} rows={2} maxLength={300} value={why} onChange={(event) => setWhy(event.target.value)} />
        </div>
      </Modal>
    </div>
  );
};

const ReportsTab = () => {
  const t = useTranslations("chatReview");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [status, setStatus] = useState<"OPEN" | "RESOLVED">("OPEN");
  const { data: reports, failed, reload } = useApiData<ChatReport[]>("/chat/admin/reports", { status });

  const resolve = async (report: ChatReport, resolution: "KEPT" | "DELETED") => {
    try {
      await axiosReq.post(`${BASE}/chat/admin/reports/${report.id}/resolve`, { resolution });
      triggerToast({ title: t(`resolved.${resolution}`), type: "success" });
      reload();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Select
        label={t("show")}
        placeholder={false}
        value={status}
        onChange={(event) => setStatus(event.target.value as "OPEN" | "RESOLVED")}
        options={[
          { value: "OPEN", label: t("statusOpen") },
          { value: "RESOLVED", label: t("statusResolved") },
        ]}
        fieldClassName="max-w-xs"
      />
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAllowed") : t("loadFailed")} onRetry={reload} />
      ) : !reports ? (
        <Skeleton lines={4} />
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState title={status === "OPEN" ? t("noReports") : t("noResolved")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t("reports")}>
          {reports.map((report) => (
            <li key={report.id}>
              <Card>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">{report.chat_label}</p>
                    <span className="text-caption text-ink-muted">{format.date(report.created_at, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  <p className="text-body-sm text-ink">{t("reportedBy", { name: report.reporter.name, reason: report.reason })}</p>
                  <ol className="flex flex-col gap-1 rounded-input bg-canvas p-3 text-body-sm" aria-label={t("context")}>
                    {report.context.map((m) => (
                      <li key={m.id} className={m.reported ? "font-semibold text-danger" : "text-ink"}>
                        {m.author_name}: {m.content || m.files.join(", ") || t("deletedMessage")}
                      </li>
                    ))}
                  </ol>
                  {report.status === "OPEN" ? (
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => void resolve(report, "KEPT")}>
                        {t("keep")}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => void resolve(report, "DELETED")}>
                        {t("deleteMessage")}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-caption text-ink-muted">
                      {t(`resolution.${report.resolution ?? "KEPT"}`, { name: report.resolved_by?.name ?? "—" })}
                    </p>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const AccessLogTab = () => {
  const t = useTranslations("chatReview");
  const format = useFormat();
  const { data: rows, failed, reload } = useApiData<ChatAccessLogRow[]>("/chat/admin/access-log");
  const columns: TableColumn<ChatAccessLogRow>[] = [
    { key: "when", header: t("when"), cell: (r) => format.date(r.opened_at, { dateStyle: "medium", timeStyle: "short" }), sortValue: (r) => new Date(r.opened_at) },
    { key: "who", header: t("who"), cell: (r) => r.actor.name, sortValue: (r) => r.actor.name },
    { key: "chat", header: t("chat"), cell: (r) => r.chat_label, sortValue: (r) => r.chat_label },
    { key: "reason", header: t("reason"), cell: (r) => r.reason },
  ];
  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!rows) return <Skeleton lines={4} />;
  return <Table caption={t("accessLogCaption")} columns={columns} rows={rows} getRowId={(r) => r.id} empty={<EmptyState title={t("noAccess")} />} />;
};

export default ChatReview;
