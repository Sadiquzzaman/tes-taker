"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, EmptyState, ErrorState, Link, PageHeader, Select, Skeleton, Table, type TableColumn } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { type IsoDay, SCHOOL_WEEK } from "@/utils/schoolDate";
import ApplySettingsDialog from "./ApplySettingsDialog";

const CLASS_TYPES: SectionClassType[] = ["IN_PERSON", "ONLINE"];
const MODES: SectionAttendanceMode[] = ["SELF_CHECKIN", "PAPER_REGISTER"];
const GRACE_CHOICES = [0, 5, 10, 15, 20, 30, 45, 60];

/**
 * Class setup (ATT-16): one row per section of a session with its weekly schedule, branch, in person
 * or online, attendance mode and grace period. Choices save at once; the schedule opens in a drawer
 * with "copy from"; a schedule can be applied to a whole class or shift. Owners, admins and
 * assistants change every section, a teacher the sections they teach; others see it read-only.
 */
const ClassSetupPage = () => {
  const t = useTranslations("classSetup");
  const tBranches = useTranslations("branches");
  const format = useFormat();
  const { baseUrl, run } = useAcademicsRequest();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [setup, setSetup] = useState<ClassSetup | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [failed, setFailed] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [applying, setApplying] = useState<SectionSetup | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const payload = await run(async () => {
      const [grid, list] = await Promise.all([
        axiosReq.get<ApiResponse<ClassSetup>>(`${baseUrl}/attendance/setup`, { params: sessionId ? { session_id: sessionId } : {} }),
        axiosReq.get<ApiResponse<Branch[]>>(`${baseUrl}/attendance/branches`),
      ]);
      return grid.data?.payload ? { grid: grid.data.payload, branches: list.data?.payload ?? [] } : null;
    });
    if (!payload) {
      setFailed(true);
      return;
    }
    setSetup(payload.grid);
    setBranches(payload.branches);
  }, [baseUrl, run, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    axiosReq
      .get<ApiResponse<AcademicSession[]>>(`${baseUrl}/sessions`)
      .then((response) => setSessions(response.data?.payload ?? []))
      .catch(() => setSessions([]));
  }, [baseUrl]);

  const canManage = setup?.can_manage ?? false;
  const sectionName = (row: SectionSetup) => `${row.class.name} ${row.name}`;

  const replaceRow = (row: SectionSetup) =>
    setSetup((current) => (current ? { ...current, sections: current.sections.map((s) => (s.id === row.id ? row : s)) } : current));

  const update = async (row: SectionSetup, body: Partial<Pick<SectionSetup, "branch_id" | "class_type" | "mode" | "grace_minutes">>) => {
    setSavingId(row.id);
    try {
      const response = await axiosReq.patch<ApiResponse<SectionSetup>>(`${baseUrl}/attendance/setup/sections/${row.id}`, body);
      if (response.data?.payload) replaceRow(response.data.payload);
      triggerToast({ title: t("saved", { section: sectionName(row) }), type: "success" });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSavingId(null);
    }
  };

  const time = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return `${format.twoDigits(h)}:${format.twoDigits(m)}`;
  };
  const branchName = (id: string) => {
    const branch = branches.find((b) => b.id === id);
    return branch ? (branch.name ?? tBranches("mainBranch")) : tBranches("removedBranch");
  };

  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of setup?.sections ?? []) seen.set(row.class.id, row.class.name);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [setup]);

  const rows = (setup?.sections ?? []).filter(
    (row) => (!classFilter || row.class.id === classFilter) && (!shiftFilter || row.shift === shiftFilter),
  );
  const multipleBranches = branches.length > 1;
  const withoutSchedule = (setup?.sections ?? []).filter((row) => row.slots.length === 0).length;
  const graceOptions = (row: SectionSetup) => {
    const values = row.grace_minutes !== null && !GRACE_CHOICES.includes(row.grace_minutes) ? [...GRACE_CHOICES, row.grace_minutes].sort((a, b) => a - b) : GRACE_CHOICES;
    return [
      { value: "", label: t("graceDefault", { minutes: setup?.late_grace_minutes ?? 10 }) },
      ...values.map((minutes) => ({ value: String(minutes), label: t("graceMinutes", { minutes }) })),
    ];
  };
  const noPin = (row: SectionSetup) => row.class_type === "IN_PERSON" && branches.find((b) => b.id === row.branch_id)?.geo_lat === null;

  const columns: TableColumn<SectionSetup>[] = [
    {
      key: "section",
      header: t("section"),
      sortValue: (row) => sectionName(row),
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-ink">{sectionName(row)}</span>
          {row.shift ? <span className="text-caption text-ink-muted">{t(`shift.${row.shift}`)}</span> : null}
        </div>
      ),
    },
    {
      key: "schedule",
      header: t("schedule"),
      cell: (row) =>
        row.slots.length === 0 ? (
          <div className="flex flex-col items-start gap-1">
            <Badge tone="warning">{t("noSchedule")}</Badge>
            {row.can_edit ? <Link href={`/routine?section=${row.id}`}>{t("addInRoutine")}</Link> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <ul className="flex flex-col gap-1 text-body-sm">
              {periodsOf(row.slots).map((line, index) => (
                <li key={index}>
                  <span className="text-ink">{line.days.map((day) => t(`dayShort.${day as IsoDay}`)).join(", ")}</span>{" "}
                  <span className="text-ink-muted">{[`${time(line.start)}–${time(line.end)}`, line.subject, line.teacher].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
            <Link href={`/routine?section=${row.id}`} aria-label={t("editInRoutineFor", { section: sectionName(row) })}>
              {row.can_edit ? t("editInRoutine") : t("viewInRoutine")}
            </Link>
          </div>
        ),
    },
    ...(multipleBranches
      ? [
          {
            key: "branch",
            header: t("branch"),
            cell: (row: SectionSetup) =>
              canManage && row.can_edit ? (
                <Select
                  label={t("branchFor", { section: sectionName(row) })}
                  hideLabel
                  className="min-w-36"
                  placeholder={false}
                  value={row.branch_id}
                  disabled={savingId === row.id}
                  onChange={(event) => void update(row, { branch_id: event.target.value })}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name ?? tBranches("mainBranch") }))}
                />
              ) : (
                branchName(row.branch_id)
              ),
          },
        ]
      : []),
    {
      key: "type",
      header: t("classType"),
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <Select
            label={t("classTypeFor", { section: sectionName(row) })}
            hideLabel
            className="min-w-32"
            placeholder={false}
            value={row.class_type}
            disabled={!row.can_edit || savingId === row.id}
            onChange={(event) => void update(row, { class_type: event.target.value as SectionClassType })}
            options={CLASS_TYPES.map((type) => ({ value: type, label: t(`classTypes.${type}`) }))}
          />
          {noPin(row) ? <span className="text-caption text-warning">{t("noPin")}</span> : null}
        </div>
      ),
    },
    {
      key: "mode",
      header: t("mode"),
      cell: (row) => (
        <Select
          label={t("modeFor", { section: sectionName(row) })}
          hideLabel
          className="min-w-36"
          placeholder={false}
          value={row.mode}
          disabled={!row.can_edit || savingId === row.id}
          onChange={(event) => void update(row, { mode: event.target.value as SectionAttendanceMode })}
          options={MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))}
        />
      ),
    },
    {
      key: "grace",
      header: t("grace"),
      cell: (row) => (
        <Select
          label={t("graceFor", { section: sectionName(row) })}
          hideLabel
          className="min-w-36"
          placeholder={false}
          value={row.grace_minutes === null ? "" : String(row.grace_minutes)}
          disabled={!row.can_edit || savingId === row.id}
          onChange={(event) => void update(row, { grace_minutes: event.target.value === "" ? null : Number(event.target.value) })}
          options={graceOptions(row)}
        />
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (row) =>
        canManage && row.can_edit ? (
          <Button size="sm" variant="ghost" onClick={() => setApplying(row)} aria-label={t("applyFor", { section: sectionName(row) })}>
            {t("apply")}
          </Button>
        ) : null,
    },
  ];

  const sessionOptions = sessions.map((session) => ({ value: session.id, label: session.name }));

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={t("intro")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {sessionOptions.length > 1 ? (
          <Select
            label={t("session")}
            value={sessionId || setup?.session.id || ""}
            placeholder={false}
            onChange={(event) => setSessionId(event.target.value)}
            options={sessionOptions}
          />
        ) : null}
        <Select label={t("class")} value={classFilter} placeholder={t("allClasses")} onChange={(event) => setClassFilter(event.target.value)} options={classes} />
        <Select
          label={t("shiftLabel")}
          value={shiftFilter}
          placeholder={t("allShifts")}
          onChange={(event) => setShiftFilter(event.target.value)}
          options={(["MORNING", "DAY", "EVENING"] as const).map((shift) => ({ value: shift, label: t(`shift.${shift}`) }))}
        />
      </div>

      <Card
        title={setup ? t("sectionsIn", { session: setup.session.name }) : undefined}
        description={setup && withoutSchedule > 0 ? t("withoutSchedule", { count: withoutSchedule }) : undefined}
      >
        {failed ? (
          <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
        ) : !setup ? (
          <div aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : setup.sections.length === 0 ? (
          <EmptyState title={t("empty")} description={t("emptyHint")} action={<Link href="/classes">{t("goToClasses")}</Link>} />
        ) : (
          <Table caption={t("title")} columns={columns} rows={rows} getRowId={(row) => row.id} />
        )}
      </Card>

      <ApplySettingsDialog
        baseUrl={baseUrl}
        source={applying}
        sectionName={sectionName}
        onClose={() => setApplying(null)}
        onApplied={(count) => {
          setApplying(null);
          triggerToast({ title: t("applied", { count }), type: "success" });
          void load();
        }}
        onError={handleError}
      />
    </div>
  );
};

/** A section's periods grouped into lines of the same time, subject and teacher: "Sat, Mon 10:00–10:45 · Mathematics · Rina". */
const periodsOf = (slots: ScheduleSlot[]) => {
  const lines: { days: number[]; start: string; end: string; subject: string | null; teacher: string | null }[] = [];
  for (const slot of slots) {
    const subject = slot.subject?.name ?? null;
    const teacher = slot.teacher?.full_name ?? null;
    const line = lines.find((l) => l.start === slot.start_time && l.end === slot.end_time && l.subject === subject && l.teacher === teacher);
    if (line) line.days.push(slot.day_of_week);
    else lines.push({ days: [slot.day_of_week], start: slot.start_time, end: slot.end_time, subject, teacher });
  }
  const order = (day: number) => SCHOOL_WEEK.indexOf(day as IsoDay);
  for (const line of lines) line.days.sort((a, b) => order(a) - order(b));
  return lines.sort((a, b) => a.start.localeCompare(b.start) || order(a.days[0]) - order(b.days[0]));
};

export default ClassSetupPage;
