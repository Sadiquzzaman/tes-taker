"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Checkbox, ConfirmDialog, DatePicker, Drawer, Input, Select, Skeleton, StatusPill, Textarea, TimePicker } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import { fromZonedParts, toZonedParts } from "@/i18n/zonedTime";
import axiosReq from "@/lib/axios";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
const TYPES: CalendarEventType[] = ["EXAM", "MEETING", "PARENT_MEETING", "ACTIVITY", "OTHER"];
const MANAGERS = ["OWNER", "ADMIN", "ASSISTANT"];

/** Refusals the form explains itself (messages `calendar.errors`). */
const EVENT_ERRORS = ["EVENT_TIME_INVALID", "EVENT_NO_ATTENDEES", "EVENT_ATTENDEE_INVALID", "EVENT_WHOLE_ORG_FORBIDDEN", "EVENT_CANCELLED", "EVENT_NOT_FOUND"] as const;
type EventError = (typeof EVENT_ERRORS)[number] | "TITLE_REQUIRED";
const isEventError = (code: unknown): code is EventError => (EVENT_ERRORS as readonly unknown[]).includes(code);

interface Props {
  /** The event to show, or "new" to add one starting on `date`. */
  target: { id: string } | { new: true; date: string };
  timeZone: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * An event (CAL-03): its type, time, place and who attends; who made it can change or cancel it
 * (owners, admins and assistants any). Adding takes the same form; attendees are sections (their
 * students), teachers, or the whole organisation (owners, admins and assistants only).
 */
const EventDrawer = ({ target, timeZone, onClose, onSaved }: Props) => {
  const t = useTranslations("calendar");
  const format = useFormat();
  const { handleError } = useApiError();
  const { memberRole, organizationId, isIndividual } = useWorkspace();
  const isNew = "new" in target;
  const [event, setEvent] = useState<CalendarEventItem | null>(null);
  const [editing, setEditing] = useState(isNew);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EventError | null>(null);
  const [form, setForm] = useState({
    type: "MEETING" as CalendarEventType,
    title: "",
    description: "",
    date: "new" in target ? target.date : "",
    start: "10:00",
    endDate: "new" in target ? target.date : "",
    end: "11:00",
    place: "",
    whole_org: false,
    section_ids: [] as string[],
    user_ids: [] as string[],
  });
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; label: string }[]>([]);
  const canInviteAll = !isIndividual && MANAGERS.includes(memberRole ?? "");

  // The event, when one is opened.
  useEffect(() => {
    if ("new" in target) return;
    let live = true;
    axiosReq
      .get<ApiResponse<CalendarEventItem>>(`${baseUrl}/events/${target.id}`)
      .then((response) => {
        if (live) setEvent(response.data?.payload ?? null);
      })
      .catch((err: AxiosError<ApiError>) => live && handleError(err));
    return () => {
      live = false;
    };
  }, [target, handleError]);

  // Choices for attendees, once the form is open: the session's sections and the organisation's teachers.
  useEffect(() => {
    if (!editing) return;
    let live = true;
    axiosReq
      .get<ApiResponse<{ sections: { id: string; name: string; class_name: string | null }[] }>>(`${baseUrl}/routine`)
      .then((response) => {
        if (live) setSections((response.data?.payload?.sections ?? []).map((s) => ({ id: s.id, label: s.class_name ? `${s.class_name} ${s.name}` : s.name })));
      })
      .catch(() => undefined);
    if (!isIndividual && organizationId) {
      axiosReq
        .get<ApiResponse<OrganizationMemberItem[]>>(`${baseUrl}/organizations/${organizationId}/assignable-teachers`)
        .then((response) => {
          if (live) setTeachers((response.data?.payload ?? []).map((m) => ({ id: m.user.id, label: m.user.full_name ?? m.user.email ?? "" })));
        })
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [editing, isIndividual, organizationId]);

  const startEditing = (from: CalendarEventItem) => {
    const start = toZonedParts(from.starts_at, timeZone);
    const end = toZonedParts(from.ends_at, timeZone);
    setForm({
      type: from.type,
      title: from.title,
      description: from.description ?? "",
      date: start.date,
      start: start.time,
      endDate: end.date,
      end: end.time,
      place: from.place ?? "",
      whole_org: from.whole_org,
      section_ids: from.sections.map((s) => s.id),
      user_ids: from.people.map((p) => p.id),
    });
    setError(null);
    setEditing(true);
  };

  const change = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const toggle = (list: "section_ids" | "user_ids", id: string) =>
    setForm((current) => ({ ...current, [list]: current[list].includes(id) ? current[list].filter((x) => x !== id) : [...current[list], id] }));

  const save = async () => {
    if (!form.title.trim()) return setError("TITLE_REQUIRED");
    const body: CalendarEventInput = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: fromZonedParts(form.date, form.start, timeZone),
      ends_at: fromZonedParts(form.endDate || form.date, form.end, timeZone),
      place: form.place.trim() || null,
      whole_org: form.whole_org,
      section_ids: form.whole_org ? [] : form.section_ids,
      user_ids: form.whole_org ? [] : form.user_ids,
    };
    setBusy(true);
    setError(null);
    try {
      if (event) await axiosReq.patch(`${baseUrl}/events/${event.id}`, body);
      else await axiosReq.post(`${baseUrl}/events`, body);
      onSaved();
    } catch (err) {
      const code = (err as AxiosError<ApiError & { code?: string }>).response?.data?.code;
      if (isEventError(code)) setError(code);
      else handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!event) return;
    setBusy(true);
    try {
      await axiosReq.post(`${baseUrl}/events/${event.id}/cancel`, {});
      onSaved();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
      setCancelling(false);
    }
  };

  const when = (from: CalendarEventItem) =>
    `${format.date(from.starts_at, { dateStyle: "full", timeZone })} · ${format.date(from.starts_at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone })}–${format.date(from.ends_at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone })}`;

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? t("event.addTitle") : (event?.title ?? t("event.title"))}
      footer={
        editing ? (
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={event ? () => setEditing(false) : onClose}>
              {t("event.close")}
            </Button>
            <Button onClick={() => void save()} loading={busy}>
              {t("event.save")}
            </Button>
          </div>
        ) : event?.can_edit ? (
          <div className="flex w-full justify-between gap-2">
            <Button variant="danger" onClick={() => setCancelling(true)}>
              {t("event.cancel")}
            </Button>
            <Button onClick={() => startEditing(event)}>{t("event.edit")}</Button>
          </div>
        ) : undefined
      }
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <Select label={t("event.type")} value={form.type} placeholder={false} options={TYPES.map((type) => ({ value: type, label: t(`types.${type}`) }))} onChange={(e) => change({ type: e.target.value as CalendarEventType })} />
          <Input label={t("event.titleLabel")} value={form.title} maxLength={200} onChange={(e) => change({ title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <DatePicker label={t("event.date")} value={form.date} onChange={(value: string) => change({ date: value, endDate: form.endDate && form.endDate >= value ? form.endDate : value })} />
            <TimePicker label={t("event.start")} value={form.start} onChange={(value) => change({ start: value })} />
            <DatePicker label={t("event.endDate")} value={form.endDate} onChange={(value: string) => change({ endDate: value })} />
            <TimePicker label={t("event.end")} value={form.end} onChange={(value) => change({ end: value })} />
          </div>
          <Input label={t("event.place")} value={form.place} maxLength={120} onChange={(e) => change({ place: e.target.value })} />
          <Textarea label={t("event.description")} value={form.description} rows={3} maxLength={2000} onChange={(e) => change({ description: e.target.value })} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-body-sm font-medium text-ink">{t("event.attendees")}</legend>
            {canInviteAll ? <Checkbox label={t("event.wholeOrg")} checked={form.whole_org} onChange={(e) => change({ whole_org: e.target.checked })} /> : null}
            {!form.whole_org ? (
              <>
                <p className="text-caption text-ink-muted">{t("event.sectionsHint")}</p>
                <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto">
                  {sections.map((s) => (
                    <Checkbox key={s.id} label={s.label} checked={form.section_ids.includes(s.id)} onChange={() => toggle("section_ids", s.id)} />
                  ))}
                </div>
                {teachers.length ? <p className="text-caption text-ink-muted">{t("event.teachersHint")}</p> : null}
                <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto">
                  {teachers.map((p) => (
                    <Checkbox key={p.id} label={p.label} checked={form.user_ids.includes(p.id)} onChange={() => toggle("user_ids", p.id)} />
                  ))}
                </div>
              </>
            ) : null}
          </fieldset>
          {error ? (
            <p role="alert" className="text-body-sm text-danger">
              {t(`errors.${error}`)}
            </p>
          ) : null}
        </div>
      ) : !event ? (
        <Skeleton lines={5} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="info">{t(`types.${event.type}`)}</StatusPill>
            {event.status === "CANCELLED" ? <StatusPill tone="danger">{t("cancelled")}</StatusPill> : null}
          </div>
          <p className="text-body text-ink">{when(event)}</p>
          {event.place ? <p className="text-body text-ink">{t("event.placeIs", { place: event.place })}</p> : null}
          {event.description ? <p className="whitespace-pre-wrap text-body text-ink">{event.description}</p> : null}
          <p className="text-body-sm text-ink-muted">
            {event.whole_org
              ? t("event.forEveryone")
              : t("event.forList", { list: [...event.sections.map((s) => (s.class_name ? `${s.class_name} ${s.name}` : s.name)), ...event.people.map((p) => p.full_name)].join(", ") })}
          </p>
          {event.created_by ? <p className="text-body-sm text-ink-muted">{t("event.madeBy", { name: event.created_by.full_name })}</p> : null}
        </div>
      )}
      <ConfirmDialog
        open={cancelling}
        title={t("event.cancelTitle")}
        description={t("event.cancelDetail")}
        confirmLabel={t("event.cancel")}
        tone="danger"
        loading={busy}
        onConfirm={() => void cancel()}
        onCancel={() => setCancelling(false)}
      />
    </Drawer>
  );
};

export default EventDrawer;
