"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import BellIconSVG from "@/component/svg/BellIconSVG";
import { Button, cn, Drawer, EmptyState, IconButton, Skeleton } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

/** How often the unread badge is refreshed (also when the tab is shown again). */
export const BELL_POLL_MS = 60_000;

/**
 * The top-bar bell (FND-12): the unread count, and the inbox in a side panel. Opening an item marks
 * it read and goes to its page. The badge refreshes every minute and when the tab comes back.
 */
const NotificationBell = () => {
  const t = useTranslations("notifications");
  const format = useFormat();
  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[] | null>(null);

  /** The unread count, or null when it could not be read (the badge keeps its last value). */
  const fetchCount = useCallback(async (): Promise<number | null> => {
    try {
      const res = await axiosReq.get<{ payload: { count: number } }>(`${baseUrl}/me/notifications/unread-count`);
      return res.data?.payload?.count ?? 0;
    } catch {
      return null;
    }
  }, [baseUrl]);

  const loadCount = useCallback(() => {
    void fetchCount().then((count) => {
      if (count !== null) setUnread(count);
    });
  }, [fetchCount]);

  const loadItems = useCallback(async () => {
    try {
      const res = await axiosReq.get<InboxResponse>(`${baseUrl}/me/notifications`, { params: { limit: 20 } });
      setItems(res.data?.payload ?? []);
      setUnread(res.data?.meta?.unread ?? 0);
    } catch {
      setItems([]);
    }
  }, [baseUrl]);

  useEffect(() => {
    loadCount();
    const timer = window.setInterval(loadCount, BELL_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadCount]);

  const openInbox = () => {
    setOpen(true);
    setItems(null);
    void loadItems();
  };

  const markRead = async (item: InboxItem) => {
    if (item.read_at) return;
    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)) ?? null);
    setUnread((count) => Math.max(0, count - 1));
    try {
      await axiosReq.patch(`${baseUrl}/me/notifications/${item.id}/read`);
    } catch {
      loadCount();
    }
  };

  const openItem = async (item: InboxItem) => {
    await markRead(item);
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  };

  const markAllRead = async () => {
    try {
      await axiosReq.post(`${baseUrl}/me/notifications/read-all`);
      setItems((prev) => prev?.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })) ?? null);
      setUnread(0);
    } catch {
      void loadItems();
    }
  };

  return (
    <>
      <span className="relative inline-flex">
        <IconButton
          label={unread ? t("bellUnread", { count: unread }) : t("bell")}
          icon={<BellIconSVG width={16} />}
          onClick={openInbox}
        />
        {unread ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-caption font-semibold text-ink-inverse"
          >
            {unread > 99 ? format.number(99) + "+" : format.number(unread)}
          </span>
        ) : null}
      </span>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        footer={
          unread ? (
            <Button variant="secondary" onClick={() => void markAllRead()}>
              {t("markAllRead")}
            </Button>
          ) : undefined
        }
      >
        {items === null ? (
          <Skeleton lines={5} />
        ) : items.length === 0 ? (
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-input px-2 py-3 text-left hover:bg-canvas",
                    !item.read_at && "bg-primary-soft",
                  )}
                  onClick={() => void openItem(item)}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-body-sm font-semibold text-ink">{item.title}</span>
                    {!item.read_at ? <span className="sr-only">{t("unread")}</span> : null}
                  </span>
                  {item.body ? <span className="text-body-sm text-ink-muted">{item.body}</span> : null}
                  <span className="text-caption text-ink-muted">{format.dateTime(item.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  );
};

export default NotificationBell;
