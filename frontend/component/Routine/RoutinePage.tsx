"use client";

import { AxiosError } from "axios";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import ScheduleImportDrawer from "@/component/Attendance/ScheduleImportDrawer";
import useApiData from "@/component/Homework/useApiData";
import useIsStudent from "@/component/Homework/useIsStudent";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Select, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import useWorkspace from "@/hooks/organization/useWorkspace";
import axiosReq from "@/lib/axios";
import RoutineSlotDrawer from "./RoutineSlotDrawer";
import RoutineWeek, { sectionLabel } from "./RoutineWeek";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

type ViewBy = "section" | "teacher" | "room";

/**
 * The weekly routine (CAL-01, CAL-02), the one place the timetable is made: a session's week by
 * section, teacher or room, clashes marked. Owners, admins and staff change every section, a
 * teacher the sections they teach: a period on one or several days, a week copied from another
 * section, or a CSV import. Students see their own sections. Each person's own week is on the Calendar.
 */
const RoutinePage = () => {
  const t = useTranslations("routine");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const isStudent = useIsStudent();
  const { isIndividual, organizationId } = useWorkspace();
  const { entitlements } = useEntitlements();
  const params = useSearchParams();
  const [sessionId, setSessionId] = useState("");
  const { data: routine, failed, reload } = useApiData<RoutineView>("/routine", { session_id: sessionId || undefined });
  const { data: sessions } = useApiData<AcademicSession[]>("/sessions");
  const [viewBy, setViewBy] = useState<ViewBy>("section");
  const [chosen, setChosen] = useState(params?.get("section") ?? "");
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<{ slot: RoutineSlot | null; start?: { section_id?: string } } | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const editable = useMemo(() => new Set(routine?.editable_section_ids ?? []), [routine]);
  const canManage = routine?.can_manage ?? false;

  // Teachers to put on a period: the organisation's teaching members.
  useEffect(() => {
    if (!canManage || isIndividual || !organizationId) return;
    let live = true;
    axiosReq
      .get<ApiResponse<OrganizationMemberItem[]>>(`${baseUrl}/organizations/${organizationId}/assignable-teachers`)
      .then((response) => {
        if (live) setTeachers((response.data?.payload ?? []).map((member) => ({ id: member.user.id, name: member.user.full_name ?? member.user.email ?? "" })));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [canManage, isIndividual, organizationId]);

  const choices = useMemo(() => {
    if (!routine) return [];
    if (viewBy === "section") return routine.sections.map((section) => ({ value: section.id, label: sectionLabel(section) }));
    if (viewBy === "teacher") {
      const seen = new Map<string, string>();
      for (const slot of routine.slots) if (slot.teacher) seen.set(slot.teacher.id, slot.teacher.full_name);
      return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }
    return routine.rooms.map((room) => ({ value: room, label: room }));
  }, [routine, viewBy]);

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!routine || isStudent === undefined) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader title={t("title")} />
        <Skeleton lines={6} />
      </div>
    );
  }

  const current = choices.some((choice) => choice.value === chosen) ? chosen : (choices[0]?.value ?? "");
  const shown = routine.slots.filter((slot) =>
    viewBy === "section" ? slot.section.id === current : viewBy === "teacher" ? slot.teacher?.id === current : slot.room?.toLowerCase() === current.toLowerCase(),
  );
  const clashCount = routine.slots.filter((slot) => slot.clashes.length > 0).length;
  const sectionEditable = viewBy === "section" && editable.has(current);
  const currentSection = routine.sections.find((section) => section.id === current);
  const canImport = canManage && Boolean(entitlements?.features?.attendance);

  const copy = async () => {
    setBusy(true);
    try {
      const done = (await axiosReq.post<ApiResponse<{ slots: number; without_teacher: number }>>(`${baseUrl}/routine/sections/${current}/copy`, { from_section_id: copyFrom })).data.payload;
      triggerToast({
        title: t("copied", { count: done.slots }),
        description: done.without_teacher > 0 ? t("copiedWithoutTeacher", { count: done.without_teacher }) : undefined,
        type: "success",
      });
      setConfirmCopy(false);
      setCopying(false);
      reload();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={isStudent ? t("studentIntro") : canManage ? t("editorIntro") : t("staffIntro")}
        actions={
          canImport ? (
            <Button variant="secondary" onClick={() => setImporting(true)}>
              {t("importCsv")}
            </Button>
          ) : undefined
        }
      />
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          {(sessions?.length ?? 0) > 1 ? (
            <Select
              label={t("session")}
              fieldClassName="md:w-48"
              value={sessionId || routine.session.id}
              placeholder={false}
              options={(sessions ?? []).map((session) => ({ value: session.id, label: session.name }))}
              onChange={(event) => setSessionId(event.target.value)}
            />
          ) : null}
          {!isStudent ? (
            <Select
              label={t("viewBy")}
              fieldClassName="md:w-40"
              value={viewBy}
              placeholder={false}
              options={(["section", "teacher", "room"] as ViewBy[]).map((value) => ({ value, label: t(`by.${value}`) }))}
              onChange={(event) => {
                setViewBy(event.target.value as ViewBy);
                setChosen("");
              }}
            />
          ) : null}
          {choices.length > 1 || viewBy !== "section" ? (
            <Select
              label={t(`by.${viewBy}`)}
              fieldClassName="md:w-56"
              value={current}
              placeholder={choices.length ? false : t("nothingToChoose")}
              options={choices}
              onChange={(event) => setChosen(event.target.value)}
            />
          ) : null}
          {sectionEditable ? (
            <div className="flex flex-wrap gap-2 md:ml-auto">
              <Button variant="secondary" onClick={() => setCopying(true)}>
                {t("copyFrom")}
              </Button>
              <Button onClick={() => setEditing({ slot: null, start: { section_id: current } })}>{t("add")}</Button>
            </div>
          ) : canManage && viewBy !== "section" ? (
            <Button className="md:ml-auto" onClick={() => setEditing({ slot: null })}>
              {t("add")}
            </Button>
          ) : null}
        </div>
        {clashCount > 0 && !isStudent ? (
          <p role="status" className="mt-3 rounded-input bg-warning-soft px-3 py-2 text-body-sm text-ink">
            {t("clashesInRoutine", { count: clashCount })}
          </p>
        ) : null}
      </Card>
      {routine.sections.length === 0 ? (
        <Card>
          <EmptyState title={isStudent ? t("noSectionsStudent") : t("noSections")} />
        </Card>
      ) : (
        <RoutineWeek
          slots={shown}
          show={{ section: viewBy !== "section", teacher: viewBy !== "teacher" }}
          onOpen={(slot) => (editable.has(slot.section.id) ? setEditing({ slot }) : undefined)}
          canOpen={(slot) => editable.has(slot.section.id)}
        />
      )}
      {editing ? (
        <RoutineSlotDrawer
          routine={routine}
          slot={editing.slot}
          start={editing.start}
          teachers={teachers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            triggerToast({ title: t("saved"), type: "success" });
            reload();
          }}
        />
      ) : null}
      <Modal
        open={copying}
        onClose={() => setCopying(false)}
        title={t("copyTitle", { section: currentSection ? sectionLabel(currentSection) : "" })}
        description={t("copyIntro")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopying(false)}>
              {t("cancel")}
            </Button>
            <Button disabled={!copyFrom} onClick={() => setConfirmCopy(true)}>
              {t("copy")}
            </Button>
          </>
        }
      >
        <Select
          label={t("copyFromLabel")}
          value={copyFrom}
          placeholder={t("chooseSection")}
          options={routine.sections.filter((section) => section.id !== current).map((section) => ({ value: section.id, label: sectionLabel(section) }))}
          onChange={(event) => setCopyFrom(event.target.value)}
        />
      </Modal>
      <ConfirmDialog
        open={confirmCopy}
        title={t("copyConfirmTitle")}
        description={t("copyConfirmDetail", { count: shown.length })}
        confirmLabel={t("copy")}
        tone="danger"
        loading={busy}
        onConfirm={() => void copy()}
        onCancel={() => setConfirmCopy(false)}
      />
      {canImport ? (
        <ScheduleImportDrawer
          open={importing}
          sessionId={routine.session.id}
          onClose={() => setImporting(false)}
          onImported={(count) => {
            setImporting(false);
            triggerToast({ title: t("imported", { count }), type: "success" });
            reload();
          }}
        />
      ) : null}
    </div>
  );
};

export default RoutinePage;
