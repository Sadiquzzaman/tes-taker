"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, ChevronLeftIcon, ChevronRightIcon, EmptyState, ErrorState, IconButton, Link, PageHeader, Skeleton, StatTile, StatusPill } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { currentPosition, shiftMonth, STATUS_TONE, todayStatus } from "@/utils/attendance/status";
import AttendanceCalendar from "./AttendanceCalendar";

/** Check-in problems the page explains itself (messages `myAttendance.errors`). */
const KNOWN_ERRORS = [
  "ATTENDANCE_CHECKIN_NOT_OPEN",
  "ATTENDANCE_CHECKIN_CLOSED",
  "ATTENDANCE_CHECKIN_ALREADY",
  "ATTENDANCE_CHECKIN_NO_PIN",
  "ATTENDANCE_CHECKIN_LOCATION_REQUIRED",
  "ATTENDANCE_CHECKIN_ACCURACY_POOR",
  "ATTENDANCE_CHECKIN_TOO_FAR",
  "ATTENDANCE_CHECKIN_CLOSED_DAY",
  "ATTENDANCE_CHECKIN_PAPER_REGISTER",
  "ATTENDANCE_CHECKIN_NO_CLASS_TODAY",
  "ATTENDANCE_CHECKIN_CANCELLED",
  "ATTENDANCE_CHECKIN_NOT_YOUR_CLASS",
] as const;
type CheckInError = (typeof KNOWN_ERRORS)[number];
const isKnownError = (code: unknown): code is CheckInError => KNOWN_ERRORS.includes(code as CheckInError);

/** Today's classes are re-read this often, so check-in opens and closes without a reload. */
const REFRESH_MS = 60_000;

/**
 * "My attendance" (ATT-18, ATT-04, ATT-11): today's classes with a "Check in" button while a class
 * is open (in-person classes send the browser's position; the server decides everything), then a
 * month calendar of the person's own classes with counts and the attendance %. On a day of approved
 * leave (P3-06) the card says so; the page links to Leave.
 */
const MyAttendancePage = () => {
  const t = useTranslations("myAttendance");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [today, setToday] = useState<MyToday | null>(null);
  const [todayFailed, setTodayFailed] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<MyCalendar | null>(null);
  const [calendarFailed, setCalendarFailed] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});

  const loadToday = useCallback(async () => {
    try {
      const response = await axiosReq.get<ApiResponse<MyToday>>(`${baseUrl}/attendance/me/today`);
      setToday(response.data?.payload ?? null);
      setTodayFailed(false);
    } catch (error) {
      setTodayFailed(true);
      handleError(error as AxiosError<ApiError>);
    }
  }, [baseUrl, handleError]);

  const loadCalendar = useCallback(async () => {
    try {
      const response = await axiosReq.get<ApiResponse<MyCalendar>>(`${baseUrl}/attendance/me/calendar`, { params: month ? { month } : {} });
      setCalendar(response.data?.payload ?? null);
      setCalendarFailed(false);
    } catch {
      setCalendarFailed(true);
    }
  }, [baseUrl, month]);

  useEffect(() => {
    void loadToday();
    const timer = window.setInterval(() => void loadToday(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadToday]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const clock = (iso: string) => format.date(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: today?.time_zone });

  const explain = (code: CheckInError, details: Record<string, unknown> = {}) =>
    t(`errors.${code}`, {
      distance: Number(details.distance_m ?? 0),
      radius: Number(details.radius_m ?? 0),
      accuracy: Number(details.accuracy_m ?? 0),
      time: typeof details.opens_at === "string" ? clock(details.opens_at) : "",
    });

  const checkIn = async (item: MyClass) => {
    setBusySlot(item.slot_id);
    setProblems((current) => ({ ...current, [item.slot_id]: "" }));
    try {
      const body: Record<string, unknown> = { slot_id: item.slot_id };
      if (item.needs_location) {
        try {
          const position = await currentPosition();
          body.latitude = position.coords.latitude;
          body.longitude = position.coords.longitude;
          body.accuracy_m = position.coords.accuracy;
        } catch (error) {
          const denied = (error as GeolocationPositionError)?.code === 1;
          setProblems((current) => ({ ...current, [item.slot_id]: t(denied ? "location.denied" : "location.unavailable") }));
          return;
        }
      }
      const response = await axiosReq.post<ApiResponse<MyClass>>(`${baseUrl}/attendance/check-in`, body);
      const saved = response.data?.payload;
      if (saved) {
        setToday((current) => (current ? { ...current, classes: current.classes.map((c) => (c.slot_id === saved.slot_id ? saved : c)) } : current));
        triggerToast({ title: t(saved.record?.status === "LATE" ? "checkedInLate" : "checkedIn", { minutes: saved.record?.late_minutes ?? 0 }), type: "success" });
        void loadCalendar();
      }
    } catch (error) {
      const data = (error as AxiosError<ApiError & { details?: Record<string, unknown> }>).response?.data;
      if (data && isKnownError(data.code)) {
        setProblems((current) => ({ ...current, [item.slot_id]: explain(data.code as CheckInError, data.details) }));
        if (data.code === "ATTENDANCE_CHECKIN_ALREADY" || data.code === "ATTENDANCE_CHECKIN_CLOSED") void loadToday();
      } else {
        handleError(error as AxiosError<ApiError>);
      }
    } finally {
      setBusySlot(null);
    }
  };

  const statusText = (item: MyClass) => {
    const status = todayStatus(item);
    if (status === "LATE") return t("lateBy", { minutes: item.record?.late_minutes ?? 0 });
    if (status === "UPCOMING") return t("opensAt", { time: clock(item.opens_at) });
    if (status === "OPEN") return t("openUntil", { time: clock(item.ends_at) });
    return t(`status.${status}`);
  };

  const shownMonth = calendar?.month ?? month;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} actions={<Link href="/leave">{t("leaveLink")}</Link>} />

      <Card
        title={today ? t("todayTitle", { date: format.date(`${today.date}T00:00:00Z`, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) }) : t("todayTitleShort")}
        description={
          today?.closed
            ? t(`closed.${today.closed.reason}`, { name: today.closed.holiday_name ?? "" })
            : today?.on_leave
              ? t("onLeaveToday")
              : undefined
        }
      >
        {todayFailed && !today ? (
          <ErrorState title={t("loadFailed")} onRetry={() => void loadToday()} />
        ) : !today ? (
          <div aria-busy="true">
            <Skeleton lines={3} />
          </div>
        ) : today.classes.length === 0 ? (
          <EmptyState title={t("noClassesToday")} description={t("noClassesTodayHint")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {today.classes.map((item) => {
              const status = todayStatus(item);
              const problem = problems[item.slot_id];
              return (
                <li key={item.slot_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{`${item.section.class_name} ${item.section.name}`}</span>
                      {item.role === "TEACHER" ? <Badge tone="primary">{t("youTeach")}</Badge> : null}
                    </div>
                    <span className="text-body-sm text-ink-muted">
                      {`${format.timeOfDay(item.start_time)}–${format.timeOfDay(item.end_time)} · ${t(`classType.${item.class_type}`)}`}
                    </span>
                    {item.blocked && item.blocked !== "CLOSED_DAY" ? <span className="text-caption text-ink-muted">{t(`blocked.${item.blocked}`)}</span> : null}
                    {item.record?.flag ? <span className="text-caption text-warning">{t(`flag.${item.record.flag}`)}</span> : null}
                    {problem ? (
                      <p role="alert" className="text-body-sm text-danger">
                        {problem}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusPill tone={STATUS_TONE[status]}>
                      <span className="font-semibold">{t(`letter.${status}`)}</span> {statusText(item)}
                    </StatusPill>
                    {item.can_check_in ? (
                      <Button size="md" onClick={() => void checkIn(item)} disabled={busySlot !== null} aria-label={t("checkInTo", { section: `${item.section.class_name} ${item.section.name}` })}>
                        {busySlot === item.slot_id ? t(item.needs_location ? "locating" : "checkingIn") : t("checkIn")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title={t("monthTitle")}
        actions={
          shownMonth ? (
            <div className="flex items-center gap-2">
              <IconButton label={t("previousMonth")} icon={<ChevronLeftIcon />} variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(shownMonth, -1))} />
              <span className="min-w-28 text-center text-body-sm font-medium text-ink">
                {format.date(`${shownMonth}-01T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" })}
              </span>
              <IconButton label={t("nextMonth")} icon={<ChevronRightIcon />} variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(shownMonth, 1))} />
            </div>
          ) : undefined
        }
      >
        {calendarFailed && !calendar ? (
          <ErrorState title={t("loadFailed")} onRetry={() => void loadCalendar()} />
        ) : !calendar ? (
          <div aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatTile label={t("attendancePct")} value={calendar.attendance_pct === null ? "—" : `${format.number(calendar.attendance_pct)}%`} />
              <StatTile label={t("status.PRESENT")} value={format.number(calendar.counts.present)} />
              <StatTile label={t("status.LATE")} value={format.number(calendar.counts.late)} />
              <StatTile label={t("status.ABSENT")} value={format.number(calendar.counts.absent)} />
              <StatTile label={t("status.LEAVE")} value={format.number(calendar.counts.leave)} />
            </div>
            <AttendanceCalendar calendar={calendar} />
          </div>
        )}
      </Card>
    </div>
  );
};

export default MyAttendancePage;
