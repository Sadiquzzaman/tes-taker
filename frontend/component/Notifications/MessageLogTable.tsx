"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { dayBoundary } from "@/component/Audit/AuditLogTable";
import { Badge, type BadgeTone, Card, DatePicker, EmptyState, FilterBar, Pagination, Select, Skeleton, Table, Tag, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const PAGE_SIZE = 20;
const CHANNELS: NotificationChannel[] = ["SMS", "EMAIL"];
const STATUSES: OutboxStatus[] = ["PENDING", "SENT", "DELIVERED", "FAILED", "NO_CREDIT"];
/** Message areas the filter offers (event types are `<area>.<event>`). */
export const MESSAGE_AREAS = ["exam", "class", "organization", "sms"] as const;

const STATUS_TONES: Record<OutboxStatus, BadgeTone> = {
  PENDING: "neutral",
  SENDING: "info",
  SENT: "success",
  DELIVERED: "success",
  FAILED: "danger",
  NO_CREDIT: "warning",
};

/**
 * The workspace's message log (FND-14): every SMS and email, who it was for, its status and the
 * credits it used, to answer "did the parent get it?". Filter by date, type, channel and status;
 * pick a recipient to see only their messages.
 */
const MessageLogTable = () => {
  const t = useTranslations("messageLog");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const [messages, setMessages] = useState<MessageLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [area, setArea] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [recipient, setRecipient] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        event_type: area ? `${area}.` : undefined,
        channel: channel || undefined,
        status: status || undefined,
        recipient_id: recipient?.id,
        from: dayBoundary(fromDay),
        to: dayBoundary(toDay, true),
      };
      const res = await axiosReq.get<MessageLogResponse>(`${baseUrl}/notifications/log`, { params });
      setMessages(res.data?.payload ?? []);
      setPageCount(res.data?.meta?.total_pages ?? 1);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
  }, [area, baseUrl, channel, fromDay, handleError, page, recipient, status, toDay]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Any filter change starts again from the first page. */
  const filter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  const hasFilters = Boolean(area || channel || status || fromDay || toDay || recipient);
  const clearFilters = () => {
    setArea("");
    setChannel("");
    setStatus("");
    setFromDay("");
    setToDay("");
    setRecipient(null);
    setPage(1);
  };

  /** A known event's name; an event the messages do not know yet shows its key. */
  const eventName = (eventType: string) => {
    const key = `events.${eventType}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : eventType;
  };
  const recipientName = (row: MessageLogItem) => row.recipient?.full_name || row.to_address || t("unknown");

  const columns: TableColumn<MessageLogItem>[] = [
    { key: "when", header: t("when"), cell: (row) => <span className="whitespace-nowrap">{format.dateTime(row.created_at)}</span> },
    {
      key: "to",
      header: t("to"),
      cell: (row) => (
        <span className="flex flex-col">
          {row.recipient ? (
            <button
              type="button"
              className="text-left font-medium text-primary underline-offset-2 hover:underline"
              aria-label={t("onlyRecipient", { name: recipientName(row) })}
              onClick={() => filter(setRecipient)({ id: row.recipient!.id, name: recipientName(row) })}
            >
              {recipientName(row)}
            </button>
          ) : (
            <span className="font-medium">{recipientName(row)}</span>
          )}
          {row.recipient && row.to_address ? <span className="text-caption text-ink-muted">{row.to_address}</span> : null}
        </span>
      ),
    },
    { key: "type", header: t("type"), cell: (row) => eventName(row.event_type), hideOnMobile: true },
    { key: "channel", header: t("channel"), cell: (row) => t(`channels.${row.channel}`) },
    {
      key: "status",
      header: t("status"),
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={STATUS_TONES[row.status]}>{t(`statuses.${row.status}`)}</Badge>
          {row.status === "FAILED" && row.error ? <span className="text-caption text-ink-muted">{row.error}</span> : null}
        </span>
      ),
    },
    {
      key: "message",
      header: t("message"),
      cell: (row) => (
        <span className="line-clamp-3 break-words text-body-sm">{row.channel === "EMAIL" ? row.subject || "—" : row.body || t("hidden")}</span>
      ),
      hideOnMobile: true,
    },
    { key: "credits", header: t("credits"), cell: (row) => (row.channel === "SMS" ? format.number(row.credits_used) : "—"), hideOnMobile: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar hasActiveFilters={hasFilters} onClear={clearFilters}>
        <Select
          label={t("type")}
          fieldClassName="sm:w-48"
          placeholder={false}
          value={area}
          onChange={(event) => filter(setArea)(event.target.value)}
          options={[{ value: "", label: t("allTypes") }, ...MESSAGE_AREAS.map((value) => ({ value, label: t(`areas.${value}`) }))]}
        />
        <Select
          label={t("channel")}
          fieldClassName="sm:w-36"
          placeholder={false}
          value={channel}
          onChange={(event) => filter(setChannel)(event.target.value)}
          options={[{ value: "", label: t("allChannels") }, ...CHANNELS.map((value) => ({ value, label: t(`channels.${value}`) }))]}
        />
        <Select
          label={t("status")}
          fieldClassName="sm:w-44"
          placeholder={false}
          value={status}
          onChange={(event) => filter(setStatus)(event.target.value)}
          options={[{ value: "", label: t("allStatuses") }, ...STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) }))]}
        />
        <DatePicker label={t("from")} fieldClassName="sm:w-44" value={fromDay} max={toDay || undefined} onChange={filter(setFromDay)} />
        <DatePicker label={t("toDay")} fieldClassName="sm:w-44" value={toDay} min={fromDay || undefined} onChange={filter(setToDay)} />
      </FilterBar>
      {recipient ? (
        <div>
          <Tag label={t("recipientFilter", { name: recipient.name })} onRemove={() => filter(setRecipient)(null)}>
            {t("recipientFilter", { name: recipient.name })}
          </Tag>
        </div>
      ) : null}
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table
            caption={t("title")}
            columns={columns}
            rows={messages}
            getRowId={(row) => row.id}
            empty={<EmptyState title={hasFilters ? t("emptyFiltered") : t("empty")} />}
          />
        )}
      </Card>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
};

export default MessageLogTable;
