"use client";

import { useTranslations } from "next-intl";
import { Drawer, Link, StatusPill } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { toZonedParts } from "@/i18n/zonedTime";
import { isCancelled, useClock, useLabel } from "./CalendarViews";

type TimedItem = Exclude<CalendarFeedItem, { kind: "HOLIDAY" }>;

interface Props {
  item: TimedItem | null;
  timeZone: string;
  /** Whether the item is in the workspace the person is in (its pages open only there). */
  here: boolean;
  showWorkspace: boolean;
  onClose: () => void;
}

/**
 * The details of a class, an exam, a homework, or an event of another workspace: when, where and
 * who, with a link to its page when it belongs to the workspace the person is in.
 */
const ItemDrawer = ({ item, timeZone, here, showWorkspace, onClose }: Props) => {
  const t = useTranslations("calendar");
  const tStatus = useTranslations("myAttendance.status");
  const format = useFormat();
  const clock = useClock(timeZone);
  const label = useLabel();
  if (!item) return null;

  const date = format.date(`${toZonedParts(item.starts_at, timeZone).date}T00:00:00Z`, { dateStyle: "full", timeZone: "UTC" });
  const time = item.kind === "HOMEWORK" ? t("dueAt", { time: clock(item.starts_at) }) : `${clock(item.starts_at)}–${clock(item.ends_at)}`;
  const rows: [string, string | null][] = [[t("details.when"), `${date}, ${time}`]];
  if (item.kind === "CLASS") {
    rows.push([t("details.section"), item.title], [t("details.teacher"), item.teacher], [t("details.room"), item.room]);
  } else if (item.kind === "EVENT") {
    rows.push([t("details.place"), item.place]);
  } else if (item.kind === "EXAM") {
    rows.push([t("details.class"), item.class_name]);
  } else {
    rows.push([t("details.subject"), item.subject], [t("details.sections"), item.sections.join(", ")]);
  }
  if (showWorkspace && item.workspace) rows.push([t("details.workspace"), item.workspace.label]);

  const link =
    !here ? null : item.kind === "HOMEWORK" ? { href: `/homework/${item.id}`, text: t("openHomework") } : item.kind === "CLASS" ? { href: `/routine?section=${item.section.id}`, text: t("openRoutine") } : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={label(item)}
      description={t(`kinds.${item.kind}`)}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {item.kind === "CLASS" ? <StatusPill tone={isCancelled(item) ? "neutral" : "info"}>{tStatus(item.status)}</StatusPill> : null}
          {item.kind === "EVENT" && item.cancelled ? <StatusPill tone="neutral">{t("cancelled")}</StatusPill> : null}
          {item.kind === "HOMEWORK" && item.handed_in !== null ? (
            <StatusPill tone={item.handed_in ? "success" : "warning"}>{t(item.handed_in ? "handedIn" : "notHandedIn")}</StatusPill>
          ) : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
          {rows
            .filter(([, value]) => value)
            .map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-ink-muted">{name}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ))}
        </dl>
        {link ? (
          <Link href={link.href} className="self-start">
            {link.text}
          </Link>
        ) : !here && item.workspace ? (
          <p className="text-body-sm text-ink-muted">{t("otherWorkspace", { workspace: item.workspace.label })}</p>
        ) : null}
      </div>
    </Drawer>
  );
};

export default ItemDrawer;
