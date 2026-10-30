"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Checkbox, Drawer, EmptyState, Select } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";

/**
 * Promote students (FND-05): the section's active students move to a section of another session,
 * all ticked at first; untick anyone held back or leaving. A summary comes before the move, and the
 * result says who moved and who was already there. Their old enrolment stays, as "Promoted".
 */
const PromoteStudentsDrawer = ({
  section,
  students,
  onClose,
  onPromoted,
}: {
  section: ClassSection;
  /** The section's active students. */
  students: SectionEnrolment[];
  onClose: () => void;
  onPromoted: () => void;
}) => {
  const t = useTranslations("academics.promotion");
  const { baseUrl, run } = useAcademicsRequest();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState(section.class_id);
  const [targets, setTargets] = useState<{ key: string; sections: ClassSection[] } | null>(null);
  const [targetId, setTargetId] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(students.map((s) => s.id)));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<PromotionResult | null>(null);

  useEffect(() => {
    void run(() => axiosReq.get<ApiResponse<AcademicSession[]>>(`${baseUrl}/sessions`)).then((res) => {
      // Open sessions other than this section's.
      const open = (res?.data?.payload ?? []).filter((s) => s.status === "ACTIVE" && s.id !== section.session_id);
      setSessions(open);
      setSessionId(open[0]?.id ?? "");
    });
    void run(() => axiosReq.get<ApiResponse<Class[]>>(`${baseUrl}/classes`)).then((res) =>
      setClasses((res?.data?.payload ?? []).map((c) => ({ id: c.id, name: c.class_name }))),
    );
  }, [baseUrl, run, section.session_id]);

  // The chosen class's sections in the chosen session.
  const targetKey = `${classId}:${sessionId}`;
  useEffect(() => {
    if (!classId || !sessionId) return;
    void run(() => axiosReq.get<ApiResponse<ClassSection[]>>(`${baseUrl}/classes/${classId}/sections?session_id=${sessionId}`)).then((res) => {
      const list = res?.data?.payload ?? [];
      setTargets({ key: `${classId}:${sessionId}`, sections: list });
      setTargetId(list[0]?.id ?? "");
    });
  }, [baseUrl, classId, run, sessionId]);
  const targetSections = targets?.key === targetKey ? targets.sections : null;

  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const target = targetSections?.find((s) => s.id === targetId);
  const session = sessions.find((s) => s.id === sessionId);
  const className = classes.find((c) => c.id === classId)?.name ?? "";
  const canPromote = Boolean(target) && chosen.size > 0;

  const promote = async () => {
    setSaving(true);
    const res = await run(() =>
      axiosReq.post<ApiResponse<PromotionResult>>(`${baseUrl}/sections/${section.id}/promotions`, {
        target_section_id: targetId,
        enrolment_ids: [...chosen],
      }),
    );
    setSaving(false);
    const payload = res?.data?.payload;
    if (!payload) return;
    setResult(payload);
    onPromoted();
  };

  if (result) {
    return (
      <Drawer open onClose={onClose} title={t("title", { name: section.name })} footer={<Button onClick={onClose}>{t("done")}</Button>}>
        <div className="flex flex-col gap-3" role="status">
          <p className="text-body text-ink">{t("moved", { count: result.promoted.length })}</p>
          {result.skipped.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-body-sm text-ink-muted">{t("skipped", { count: result.skipped.length })}</p>
              <ul className="list-disc pl-5 text-body-sm text-ink">
                {result.skipped.map((s) => (
                  <li key={s.student_id}>{s.full_name ?? "—"}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("title", { name: section.name })}
      description={t("intro")}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void promote()} disabled={!canPromote} loading={saving}>
            {t("promote", { count: chosen.size })}
          </Button>
        </>
      }
    >
      {sessions.length === 0 ? (
        <EmptyState title={t("noSession")} description={t("noSessionDetail")} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              label={t("session")}
              placeholder={false}
              value={sessionId}
              options={sessions.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(e) => setSessionId(e.target.value)}
            />
            <Select
              label={t("class")}
              placeholder={false}
              value={classId}
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(e) => setClassId(e.target.value)}
            />
            <Select
              label={t("section")}
              placeholder={false}
              value={targetId}
              disabled={!targetSections?.length}
              options={(targetSections ?? []).map((s) => ({ value: s.id, label: s.name }))}
              onChange={(e) => setTargetId(e.target.value)}
              hint={targetSections && targetSections.length === 0 ? t("noSection") : undefined}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-body-sm font-medium text-ink">{t("students")}</legend>
            <p className="text-caption text-ink-muted">{t("studentsHint")}</p>
            {students.map((row) => (
              <Checkbox
                key={row.id}
                label={row.roll_no ? t("studentWithRoll", { name: row.student?.full_name ?? "—", roll: row.roll_no }) : (row.student?.full_name ?? "—")}
                checked={chosen.has(row.id)}
                onChange={(e) => toggle(row.id, e.target.checked)}
              />
            ))}
          </fieldset>

          {target && session ? (
            <p className="rounded-card bg-canvas p-4 text-body-sm text-ink" aria-live="polite">
              {t("summary", { count: chosen.size, className, section: target.name, session: session.name, held: students.length - chosen.size })}
            </p>
          ) : null}
        </div>
      )}
    </Drawer>
  );
};

export default PromoteStudentsDrawer;
