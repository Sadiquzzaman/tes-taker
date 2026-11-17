"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DatePicker,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  Link,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  Table,
  type BadgeTone,
  type TableColumn,
} from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { IELTS_MODULES } from "./bands";

export const COURSE_STATUS_TONE: Record<IeltsCourseStatus, BadgeTone> = { UPCOMING: "info", RUNNING: "success", ENDED: "neutral" };

type Branch = { id: string; name: string | null; is_default: boolean };
type Teacher = { user: { id: string; full_name: string | null; phone: string | null } };
type Form = {
  title: string;
  branch_id: string;
  start_date: string;
  end_date: string;
  modules: IeltsModule[];
  seat_limit: string;
  teachers: Partial<Record<IeltsModule, string>>;
};

const EMPTY: Form = { title: "", branch_id: "", start_date: "", end_date: "", modules: [], seat_limit: "", teachers: {} };

/**
 * IELTS courses (P12-05, IEL-13) for owners, admins, branch managers and solo trainers: each course
 * with its branch, dates, status, modules and teachers, students and seats; make and change courses.
 * Students and the timetable are managed on the course's class page.
 */
const IeltsCourses = () => {
  const t = useTranslations("ieltsCourses");
  const tModules = useTranslations("ieltsTests.modulesShort");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { organizationId, memberRole, isIndividual } = useWorkspace();
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  const [statusFilter, setStatusFilter] = useState("");
  const { data: courses, failed, reload } = useApiData<IeltsCourse[]>("/ielts/courses");
  const [editing, setEditing] = useState<IeltsCourse | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<IeltsCourse | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  // Owners, admins, branch managers and solo trainers run courses; teachers read the ones they teach.
  const canManage = isIndividual || memberRole === "OWNER" || memberRole === "ADMIN" || memberRole === "BRANCH_MANAGER";
  const isBranchManager = memberRole === "BRANCH_MANAGER";

  useEffect(() => {
    if (!canManage || isIndividual || isBranchManager || !organizationId) return;
    axiosReq
      .get<{ payload: Branch[] }>(`${base}/attendance/branches`)
      .then((res) => setBranches(res.data?.payload ?? []))
      .catch(() => setBranches([]));
    axiosReq
      .get<{ payload: Teacher[] }>(`${base}/organizations/${organizationId}/assignable-teachers`)
      .then((res) => setTeachers(res.data?.payload ?? []))
      .catch(() => setTeachers([]));
  }, [base, canManage, isBranchManager, isIndividual, organizationId]);

  const open = (course: IeltsCourse | "new") => {
    setEditing(course);
    setForm(
      course === "new"
        ? EMPTY
        : {
            title: course.title,
            branch_id: course.branch?.id ?? "",
            start_date: course.start_date,
            end_date: course.end_date,
            modules: course.modules,
            seat_limit: course.seat_limit ? String(course.seat_limit) : "",
            teachers: Object.fromEntries(course.teachers.map((m) => [m.module, m.teachers[0]?.id ?? ""])),
          },
    );
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const teacherIds = Object.fromEntries(form.modules.filter((m) => form.teachers[m] !== undefined).map((m) => [m, form.teachers[m] ? [form.teachers[m] as string] : []]));
      const body = {
        title: form.title,
        start_date: form.start_date,
        end_date: form.end_date,
        modules: form.modules,
        seat_limit: form.seat_limit ? Number(form.seat_limit) : null,
        ...(form.branch_id ? { branch_id: form.branch_id } : {}),
        ...(teachers.length > 0 ? { teachers: teacherIds } : {}),
      };
      if (editing === "new") await axiosReq.post(`${base}/ielts/courses`, body);
      else await axiosReq.patch(`${base}/ielts/courses/${editing.id}`, body);
      triggerToast({ title: editing === "new" ? t("created") : t("saved"), type: "success" });
      setEditing(null);
      reload();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);
    try {
      await axiosReq.delete(`${base}/ielts/courses/${removing.id}`);
      triggerToast({ title: t("removed"), type: "success" });
      setRemoving(null);
      reload();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const branchName = (branch: IeltsCourse["branch"] | Branch | null) => (!branch ? t("mainBranch") : branch.name || t("mainBranch"));
  const shown = useMemo(() => (courses ?? []).filter((c) => !statusFilter || c.status === statusFilter), [courses, statusFilter]);
  const showBranches = branches.filter((b) => !b.is_default).length > 0;

  const columns: TableColumn<IeltsCourse>[] = [
    {
      key: "title",
      header: t("course"),
      cell: (c) => (
        <span className="flex flex-col">
          {canManage ? (
            <button type="button" className="self-start text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => open(c)}>
              {c.title}
            </button>
          ) : (
            <span className="font-medium text-ink">{c.title}</span>
          )}
          {showBranches || isBranchManager ? <span className="text-body-sm text-ink-muted">{branchName(c.branch)}</span> : null}
        </span>
      ),
      sortValue: (c) => c.title,
    },
    { key: "dates", header: t("dates"), cell: (c) => `${format.date(c.start_date)} – ${format.date(c.end_date)}`, sortValue: (c) => c.start_date },
    { key: "status", header: t("status"), cell: (c) => <StatusPill tone={COURSE_STATUS_TONE[c.status]}>{t(`statuses.${c.status}`)}</StatusPill> },
    { key: "modules", header: t("modules"), hideOnMobile: true, cell: (c) => c.modules.map((m) => tModules(m)).join(", ") },
    {
      key: "students",
      header: t("students"),
      cell: (c) => (c.seat_limit ? t("seatsTaken", { taken: c.students, limit: c.seat_limit }) : format.number(c.students)),
      sortValue: (c) => c.students,
    },
    {
      key: "teachers",
      header: t("teachers"),
      hideOnMobile: true,
      cell: (c) =>
        c.teachers
          .map((m) => `${tModules(m.module)}: ${m.teachers.map((x) => x.full_name ?? "—").join(", ") || t("noTeacher")}`)
          .join(" · "),
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Link href={`/classes/details/${c.class_id}`} className="text-body-sm">
            {t("studentsAndTimetable")}
          </Link>
          {canManage && c.students === 0 ? (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(c)}>
              {t("remove")}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const toggleModule = (module: IeltsModule, on: boolean) =>
    setForm((f) => ({ ...f, modules: IELTS_MODULES.filter((m) => (m === module ? on : f.modules.includes(m))) }));

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} actions={canManage ? <Button onClick={() => open("new")}>{t("new")}</Button> : undefined} />
      <Select
        label={t("status")}
        value={statusFilter}
        placeholder={t("allStatuses")}
        options={(["RUNNING", "UPCOMING", "ENDED"] as const).map((s) => ({ value: s, label: t(`statuses.${s}`) }))}
        onChange={(event) => setStatusFilter(event.target.value)}
        fieldClassName="sm:max-w-xs"
      />
      <Card flush>
        {failed !== null ? (
          <ErrorState title={t("loadFailed")} onRetry={reload} />
        ) : courses === null ? (
          <div className="p-4">
            <Skeleton lines={4} />
          </div>
        ) : (
          <Table caption={t("title")} columns={columns} rows={shown} getRowId={(c) => c.id} empty={<EmptyState title={t("empty")} description={canManage ? t("emptyHint") : undefined} />} />
        )}
      </Card>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("new") : t("edit")}
        description={t("formIntro")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t("cancel")}
            </Button>
            <Button loading={saving} disabled={!form.title.trim() || !form.start_date || !form.end_date || form.modules.length === 0} onClick={() => void save()}>
              {t("save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label={t("courseTitle")} hint={t("courseTitleHint")} value={form.title} maxLength={150} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          {showBranches ? (
            <Select
              label={t("branch")}
              value={form.branch_id}
              placeholder={t("mainBranch")}
              options={branches.filter((b) => !b.is_default).map((b) => ({ value: b.id, label: branchName(b) }))}
              onChange={(event) => setForm({ ...form, branch_id: event.target.value })}
            />
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker label={t("startDate")} value={form.start_date} onChange={(value) => setForm({ ...form, start_date: value })} />
            <DatePicker label={t("endDate")} value={form.end_date} min={form.start_date || undefined} onChange={(value) => setForm({ ...form, end_date: value })} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-body-sm font-medium text-ink">{t("modules")}</legend>
            {IELTS_MODULES.map((module) => (
              <Checkbox key={module} label={tModules(module)} checked={form.modules.includes(module)} onChange={(event) => toggleModule(module, event.target.checked)} />
            ))}
          </fieldset>
          <Input
            label={t("seatLimit")}
            hint={t("seatLimitHint")}
            type="number"
            min={1}
            max={1000}
            value={form.seat_limit}
            onChange={(event) => setForm({ ...form, seat_limit: event.target.value })}
            className="sm:max-w-xs"
          />
          {teachers.length > 0
            ? form.modules.map((module) => (
                <Select
                  key={module}
                  label={t("teacherFor", { module: tModules(module) })}
                  value={form.teachers[module] ?? ""}
                  placeholder={t("noTeacher")}
                  options={teachers.map((x) => ({ value: x.user.id, label: x.user.full_name || x.user.phone || "—" }))}
                  onChange={(event) => setForm({ ...form, teachers: { ...form.teachers, [module]: event.target.value } })}
                />
              ))
            : null}
          <p className="text-body-sm text-ink-muted">{t("studentsHint")}</p>
        </div>
      </Drawer>

      <ConfirmDialog
        open={removing !== null}
        tone="danger"
        title={t("removeTitle", { title: removing?.title ?? "" })}
        description={t("removeDetail")}
        confirmLabel={t("remove")}
        loading={saving}
        onCancel={() => setRemoving(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
};

export default IeltsCourses;
