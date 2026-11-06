"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  Drawer,
  EmptyState,
  ErrorState,
  FileDrop,
  type FileDropItem,
  Input,
  Link,
  Modal,
  PageHeader,
  RadioGroup,
  Select,
  Skeleton,
  StatusPill,
  Table,
  type TableColumn,
  Tabs,
  Textarea,
} from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import { getStoredUser } from "@/lib/authSession";
import axiosReq from "@/lib/axios";
import { uploadMedia } from "@/utils/media/uploadMedia";
import { addDays } from "@/utils/schoolDate";

/** Problems the form explains itself (messages `leave.errors`); the API's codes and our own checks. */
const API_ERRORS = [
  "ATTENDANCE_LEAVE_DATES_INVALID",
  "ATTENDANCE_LEAVE_TOO_LONG",
  "ATTENDANCE_LEAVE_TOO_OLD",
  "ATTENDANCE_LEAVE_TOO_FAR",
  "ATTENDANCE_LEAVE_NO_SCHOOL_DAYS",
  "ATTENDANCE_LEAVE_OVERLAP",
  "ATTENDANCE_LEAVE_NOT_ALLOWED",
  "ATTENDANCE_LEAVE_PERSON_NOT_FOUND",
  "ATTENDANCE_LEAVE_FILE_INVALID",
  "ATTENDANCE_LEAVE_NOT_PENDING",
  "ATTENDANCE_LEAVE_CANNOT_CANCEL",
  "ATTENDANCE_LEAVE_NOT_APPROVER",
  "ATTENDANCE_LEAVE_OWN_REQUEST",
] as const;
type ApiErrorCode = (typeof API_ERRORS)[number];
const isApiError = (code: unknown): code is ApiErrorCode => API_ERRORS.includes(code as ApiErrorCode);
type FormError = ApiErrorCode | "PERSON_REQUIRED" | "REASON_REQUIRED" | "UPLOAD_FAILED";

/** Leave can start this many days back (the API's rule, shown as the date picker's minimum). */
const BACK_DAYS = 30;

const STATUS_TONE: Record<LeaveStatus, "warning" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

type ApprovalFilter = "PENDING" | "DECIDED" | "ALL";

interface Draft {
  who: "self" | "other";
  personId: string;
  search: string;
  from: string;
  to: string;
  reason: string;
  file: { id: string; name: string } | null;
}

interface Decision {
  request: LeaveRequest;
  approve: boolean;
  note: string;
}

/**
 * Leave (ATT-09, ATT-11): apply for leave (for yourself, or as staff for a student or teacher),
 * "My leave" with the answers and a withdraw button, and "To approve" for class teachers,
 * teachers, admins and owners with approve or don't approve and a comment. The server decides who
 * may do what; the page shows what `GET /attendance/leave/mine` allows.
 */
const LeavePage = () => {
  const t = useTranslations("leave");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const myId = getStoredUser()?.id;
  const [mine, setMine] = useState<MyLeave | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<string>("mine");
  const [filter, setFilter] = useState<ApprovalFilter>("PENDING");
  const [approvals, setApprovals] = useState<LeaveRequest[] | null>(null);
  const [approvalsFailed, setApprovalsFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<{ code: FormError; details?: Record<string, unknown> } | null>(null);
  const [people, setPeople] = useState<LeavePeople | null>(null);
  const [upload, setUpload] = useState<FileDropItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState<LeaveRequest | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionProblem, setDecisionProblem] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    try {
      const response = await axiosReq.get<ApiResponse<MyLeave>>(`${baseUrl}/attendance/leave/mine`);
      const payload = response.data?.payload ?? null;
      setMine(payload);
      setFailed(false);
      if (payload && !payload.can_apply && payload.requests.length === 0 && payload.can_approve) setTab((current) => (current === "mine" ? "approvals" : current));
    } catch (error) {
      setFailed(true);
      handleError(error as AxiosError<ApiError>);
    }
  }, [baseUrl, handleError]);

  const loadApprovals = useCallback(async () => {
    setApprovals(null);
    try {
      const response = await axiosReq.get<ApiResponse<LeaveRequest[]>>(`${baseUrl}/attendance/leave/approvals`, { params: { status: filter } });
      setApprovals(response.data?.payload ?? []);
      setApprovalsFailed(false);
    } catch {
      setApprovalsFailed(true);
    }
  }, [baseUrl, filter]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    if (mine?.can_approve) void loadApprovals();
  }, [mine?.can_approve, loadApprovals]);

  // Whom staff may apply for, searched by name on the server (big schools have thousands of students).
  useEffect(() => {
    if (!draft || draft.who !== "other") return;
    const query = draft.search.trim();
    const timer = window.setTimeout(() => {
      axiosReq
        .get<ApiResponse<LeavePeople>>(`${baseUrl}/attendance/leave/people`, { params: { q: query } })
        .then((response) => setPeople(response.data?.payload ?? null))
        .catch(() => setPeople(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [baseUrl, draft?.who, draft?.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = mine?.today ?? "";
  const dates = (request: Pick<LeaveRequest, "from_date" | "to_date">) =>
    request.from_date === request.to_date
      ? format.date(request.from_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : t("range", { from: format.date(request.from_date, { day: "numeric", month: "short" }), to: format.date(request.to_date, { day: "numeric", month: "short", year: "numeric" }) });

  const openApply = () => {
    setProblem(null);
    setUpload(null);
    setPeople(null);
    setDraft({ who: mine?.can_apply ? "self" : "other", personId: "", search: "", from: "", to: "", reason: "", file: null });
  };

  const attach = async (files: File[]) => {
    const file = files[0];
    if (!file || !draft) return;
    const id = `${file.name}-${file.lastModified}`;
    setUpload({ id, name: file.name, progress: 0 });
    try {
      const stored = await uploadMedia("leave", file, undefined, { onProgress: (progress) => setUpload({ id, name: file.name, progress }) });
      setUpload({ id, name: stored.file_name, sizeBytes: stored.size });
      setDraft((current) => (current ? { ...current, file: { id: stored.id, name: stored.file_name } } : current));
    } catch {
      setUpload({ id, name: file.name, error: t("errors.UPLOAD_FAILED") });
    }
  };

  const submit = async () => {
    if (!draft) return;
    if (draft.who === "other" && !draft.personId) return setProblem({ code: "PERSON_REQUIRED" });
    if (!draft.from || (draft.to && draft.to < draft.from)) return setProblem({ code: "ATTENDANCE_LEAVE_DATES_INVALID" });
    if (draft.reason.trim().length < 3) return setProblem({ code: "REASON_REQUIRED" });
    setSaving(true);
    try {
      const response = await axiosReq.post<ApiResponse<LeaveRequest>>(`${baseUrl}/attendance/leave`, {
        from_date: draft.from,
        to_date: draft.to || draft.from,
        reason: draft.reason.trim(),
        ...(draft.file ? { file_id: draft.file.id } : {}),
        ...(draft.who === "other" ? { person_id: draft.personId } : {}),
      });
      const saved = response.data?.payload;
      triggerToast({ title: saved?.status === "APPROVED" ? t("form.approvedAtOnce") : t("form.applied"), type: "success" });
      setDraft(null);
      void loadMine();
      if (mine?.can_approve) void loadApprovals();
    } catch (error) {
      const data = (error as AxiosError<ApiError & { details?: Record<string, unknown> }>).response?.data;
      if (data && isApiError(data.code)) setProblem({ code: data.code, details: data.details });
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    if (!withdrawing) return;
    setSaving(true);
    try {
      await axiosReq.post(`${baseUrl}/attendance/leave/${withdrawing.id}/cancel`, {});
      triggerToast({ title: t("withdrawn"), type: "success" });
      void loadMine();
      if (mine?.can_approve) void loadApprovals();
    } catch (error) {
      const code = (error as AxiosError<ApiError>).response?.data?.code;
      if (isApiError(code)) triggerToast({ title: t(`errors.${code}`, { days: 0, from: "", to: "" }), type: "error" });
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
      setWithdrawing(null);
    }
  };

  const decide = async () => {
    if (!decision) return;
    const note = decision.note.trim();
    if (!decision.approve && note.length < 3) return setDecisionProblem(t("noteRequired"));
    setSaving(true);
    try {
      await axiosReq.post(`${baseUrl}/attendance/leave/${decision.request.id}/${decision.approve ? "approve" : "reject"}`, note ? { note } : {});
      triggerToast({ title: decision.approve ? t("approved") : t("rejected"), type: "success" });
      setDecision(null);
      void loadApprovals();
    } catch (error) {
      const code = (error as AxiosError<ApiError>).response?.data?.code;
      if (isApiError(code)) setDecisionProblem(t(`errors.${code}`, { days: 0, from: "", to: "" }));
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const fileLink = (request: LeaveRequest) =>
    request.file ? (
      <Link href={`${baseUrl}/files/${request.file.id}/content`} target="_blank" rel="noreferrer" aria-label={t("openAttachment", { name: request.file.name ?? t("attachment") })}>
        {t("attachment")}
      </Link>
    ) : null;

  const answer = (request: LeaveRequest) => {
    if (request.status === "CANCELLED" && request.cancelled_by) return t("withdrawnBy", { name: request.cancelled_by.full_name });
    if (!request.decided_by || request.status === "PENDING") return <span className="text-ink-muted">—</span>;
    return request.decision_note
      ? t("decidedBy", { name: request.decided_by.full_name, note: request.decision_note })
      : t("decidedByNoNote", { name: request.decided_by.full_name });
  };

  const forOthers = useMemo(() => (mine?.requests ?? []).some((request) => request.person.id !== myId), [mine, myId]);

  const mineColumns: TableColumn<LeaveRequest>[] = [
    { key: "dates", header: t("columns.dates"), cell: (r) => <span className="font-medium text-ink">{dates(r)}</span>, sortValue: (r) => r.from_date },
    { key: "days", header: t("columns.days"), cell: (r) => format.number(r.school_days), align: "right" },
    ...(forOthers
      ? [{ key: "person", header: t("columns.person"), cell: (r: LeaveRequest) => (r.person.id === myId ? t("form.myself") : r.person.full_name) }]
      : []),
    { key: "status", header: t("columns.status"), cell: (r) => <StatusPill tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</StatusPill> },
    {
      key: "reason",
      header: t("columns.reason"),
      cell: (r) => (
        <div className="flex flex-col gap-1">
          <span>{r.reason}</span>
          {fileLink(r)}
        </div>
      ),
    },
    { key: "answer", header: t("columns.answer"), cell: (r) => answer(r) },
    {
      key: "actions",
      header: t("columns.actions"),
      align: "right",
      cell: (r) =>
        r.can_cancel ? (
          <Button size="sm" variant="ghost" onClick={() => setWithdrawing(r)} aria-label={t("withdrawNamed", { dates: dates(r) })}>
            {t("withdraw")}
          </Button>
        ) : null,
    },
  ];

  const approvalCard = (request: LeaveRequest) => (
    <li key={request.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium text-ink">
          {request.person.full_name}{" "}
          <span className="text-body-sm font-normal text-ink-muted">{request.class_name || t(`personType.${request.person_type}`)}</span>
        </p>
        <p className="text-body-sm text-ink">
          {dates(request)} · {t("days", { count: request.school_days })}
        </p>
        <p className="text-body-sm text-ink">{request.reason}</p>
        <div className="flex flex-wrap items-center gap-3 text-caption text-ink-muted">
          <StatusPill tone={STATUS_TONE[request.status]}>{t(`status.${request.status}`)}</StatusPill>
          {request.applied_by && request.applied_by.id !== request.person.id ? <span>{t("appliedBy", { name: request.applied_by.full_name })}</span> : null}
          {request.status !== "PENDING" ? <span>{answer(request)}</span> : null}
          {fileLink(request)}
        </div>
      </div>
      {request.can_decide ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => openDecision(request, true)} aria-label={t("approveNamed", { name: request.person.full_name })}>
            {t("approve")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openDecision(request, false)} aria-label={t("rejectNamed", { name: request.person.full_name })}>
            {t("reject")}
          </Button>
        </div>
      ) : request.can_cancel ? (
        <Button size="sm" variant="ghost" onClick={() => setWithdrawing(request)} aria-label={t("withdrawNamed", { dates: dates(request) })}>
          {t("withdraw")}
        </Button>
      ) : null}
    </li>
  );

  const openDecision = (request: LeaveRequest, approve: boolean) => {
    setDecisionProblem(null);
    setDecision({ request, approve, note: "" });
  };

  const mineContent = !mine ? null : mine.requests.length === 0 ? (
    <EmptyState title={t("emptyMine")} description={t("emptyMineHint")} action={mine.can_apply ? <Button onClick={openApply}>{t("apply")}</Button> : undefined} />
  ) : (
    <Table caption={t("tabs.mine")} columns={mineColumns} rows={mine.requests} getRowId={(r) => r.id} />
  );

  const approvalsContent = (
    <div className="flex flex-col gap-4">
      <Select
        label={t("filter")}
        className="sm:max-w-48"
        value={filter}
        placeholder={false}
        onChange={(event) => setFilter(event.target.value as ApprovalFilter)}
        options={(["PENDING", "DECIDED", "ALL"] as const).map((value) => ({ value, label: t(`filters.${value}`) }))}
      />
      {approvalsFailed ? (
        <ErrorState title={t("loadFailed")} onRetry={() => void loadApprovals()} />
      ) : !approvals ? (
        <div aria-busy="true">
          <Skeleton lines={3} />
        </div>
      ) : approvals.length === 0 ? (
        <EmptyState title={filter === "PENDING" ? t("emptyApprovals") : t("emptyDecided")} description={filter === "PENDING" ? t("emptyApprovalsHint") : undefined} />
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t("tabs.approvals")}>
          {approvals.map(approvalCard)}
        </ul>
      )}
    </div>
  );

  const waiting = filter === "PENDING" && approvals ? approvals.length : 0;
  const tabs = mine
    ? [
        ...(mine.can_apply || mine.requests.length > 0 || !mine.can_approve ? [{ key: "mine", label: t("tabs.mine"), content: mineContent }] : []),
        ...(mine.can_approve ? [{ key: "approvals", label: t("tabs.approvals"), badge: waiting > 0 ? format.number(waiting) : undefined, content: approvalsContent }] : []),
      ]
    : [];

  const personOptions = people
    ? [
        ...people.students.map((p) => ({ value: p.id, label: p.class_name ? `${p.full_name} (${p.class_name})` : p.full_name })),
        ...people.staff.map((p) => ({ value: p.id, label: `${p.full_name} (${t("personType.TEACHER")})` })),
      ]
    : [];

  const problemText = (value: { code: FormError; details?: Record<string, unknown> }) => {
    const details = value.details ?? {};
    return t(`errors.${value.code}`, {
      days: Number(details.days ?? 0),
      from: typeof details.from_date === "string" ? format.date(details.from_date, { day: "numeric", month: "short" }) : "",
      to: typeof details.to_date === "string" ? format.date(details.to_date, { day: "numeric", month: "short" }) : "",
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={mine && (mine.can_apply || mine.can_apply_for_others) ? <Button onClick={openApply}>{t("apply")}</Button> : undefined}
      />

      {failed ? (
        <ErrorState title={t("loadFailed")} onRetry={() => void loadMine()} />
      ) : !mine ? (
        <Card>
          <div aria-busy="true">
            <Skeleton lines={4} />
          </div>
        </Card>
      ) : tabs.length === 1 ? (
        <Card title={tabs[0].label}>{tabs[0].content}</Card>
      ) : (
        <Tabs tabs={tabs} selectedKey={tab} onChange={setTab} />
      )}

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={t("form.title")}
        description={t("form.hint")}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="submit" form="leave-form" loading={saving} disabled={upload?.progress !== undefined && upload.progress < 100 && !upload.error}>
              {t("form.submit")}
            </Button>
          </div>
        }
      >
        {draft ? (
          <form
            id="leave-form"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {mine?.can_apply_for_others ? (
              <RadioGroup
                legend={t("form.who")}
                name="leave-who"
                value={draft.who}
                onChange={(value) => {
                  setDraft({ ...draft, who: value as Draft["who"], personId: "" });
                  setProblem(null);
                }}
                options={[
                  ...(mine.can_apply ? [{ value: "self", label: t("form.myself") }] : []),
                  { value: "other", label: t("form.someoneElse") },
                ]}
              />
            ) : null}
            {draft.who === "other" ? (
              <>
                <Input
                  label={t("form.search")}
                  value={draft.search}
                  autoComplete="off"
                  maxLength={100}
                  onChange={(event) => setDraft({ ...draft, search: event.target.value })}
                />
                <Select
                  label={t("form.person")}
                  value={draft.personId}
                  required
                  hint={people && personOptions.length === 0 ? t("form.noPeople") : undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, personId: event.target.value });
                    setProblem(null);
                  }}
                  options={personOptions}
                />
              </>
            ) : null}
            <DatePicker
              label={t("form.from")}
              value={draft.from}
              min={today ? addDays(today, -BACK_DAYS) : undefined}
              required
              onChange={(value) => {
                setDraft({ ...draft, from: value });
                setProblem(null);
              }}
            />
            <DatePicker
              label={t("form.to")}
              hint={t("form.toHint")}
              value={draft.to}
              min={draft.from || undefined}
              onChange={(value) => {
                setDraft({ ...draft, to: value });
                setProblem(null);
              }}
            />
            <Textarea
              label={t("form.reason")}
              hint={t("form.reasonHint")}
              value={draft.reason}
              required
              maxLength={500}
              rows={3}
              onChange={(event) => {
                setDraft({ ...draft, reason: event.target.value });
                setProblem(null);
              }}
            />
            <FileDrop
              label={t("form.file")}
              acceptLabel={t("form.fileTypes")}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              maxSizeMb={20}
              items={upload ? [upload] : []}
              onFiles={(files) => void attach(files)}
              onRemove={() => {
                setUpload(null);
                setDraft({ ...draft, file: null });
              }}
            />
            {problem ? (
              <p role="alert" className="text-body-sm text-danger">
                {problemText(problem)}
              </p>
            ) : null}
          </form>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={withdrawing !== null}
        title={t("withdrawTitle")}
        description={withdrawing ? t("withdrawDescription", { dates: dates(withdrawing) }) : undefined}
        confirmLabel={t("withdraw")}
        loading={saving}
        onConfirm={() => void withdraw()}
        onCancel={() => setWithdrawing(null)}
      />

      <Modal
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={decision ? t(decision.approve ? "approveTitle" : "rejectTitle", { name: decision.request.person.full_name }) : ""}
        description={
          decision
            ? t("decisionHint", { dates: dates(decision.request), days: t("days", { count: decision.request.school_days }), reason: decision.request.reason })
            : undefined
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDecision(null)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button variant={decision?.approve ? "primary" : "danger"} loading={saving} onClick={() => void decide()}>
              {decision?.approve ? t("approve") : t("reject")}
            </Button>
          </div>
        }
      >
        {decision ? (
          <div className="flex flex-col gap-3">
            <Textarea
              label={t("noteLabel", { name: decision.request.person.full_name })}
              hint={decision.approve ? t("noteOptional") : t("noteRequired")}
              value={decision.note}
              required={!decision.approve}
              maxLength={500}
              rows={3}
              onChange={(event) => {
                setDecision({ ...decision, note: event.target.value });
                setDecisionProblem(null);
              }}
            />
            {decisionProblem ? (
              <p role="alert" className="text-body-sm text-danger">
                {decisionProblem}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default LeavePage;
