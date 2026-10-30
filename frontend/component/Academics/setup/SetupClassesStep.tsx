"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";

type SetupClass = AcademicSetupSummary["classes"][number];

/** One class and its subjects: add a subject from the organisation's list. */
const ClassSubjectsRow = ({ setupClass, subjects, onChanged }: { setupClass: SetupClass; subjects: OrganizationSubjectItem[]; onChanged: () => void }) => {
  const t = useTranslations("academics.setup.classes");
  const { baseUrl, run } = useAcademicsRequest();
  const [attached, setAttached] = useState<ClassSubject[] | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchAttached = useCallback(
    () => run(() => axiosReq.get<ApiResponse<ClassSubject[]>>(`${baseUrl}/classes/${setupClass.id}/subjects`)).then((res) => res?.data?.payload ?? []),
    [baseUrl, run, setupClass.id],
  );

  useEffect(() => {
    void fetchAttached().then(setAttached);
  }, [fetchAttached]);

  const available = subjects.filter((s) => !attached?.some((a) => a.subject_id === s.id));

  const add = async () => {
    setAdding(true);
    const saved = await run(() => axiosReq.post(`${baseUrl}/classes/${setupClass.id}/subjects`, { subject_id: subjectId }), t("subjectAdded"));
    setAdding(false);
    if (!saved) return;
    setSubjectId("");
    void fetchAttached().then(setAttached);
    onChanged();
  };

  return (
    <li className="flex flex-col gap-3 py-4">
      <p className="text-body font-medium text-ink">{setupClass.name}</p>
      {attached === null ? (
        <Skeleton lines={1} />
      ) : attached.length === 0 ? (
        <p className="text-body-sm text-ink-muted">{t("noSubjects")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {attached.map((row) => (
            <Badge key={row.id}>{row.subject?.name ?? "—"}</Badge>
          ))}
        </div>
      )}
      {available.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Select
            label={t("subject")}
            hideLabel
            placeholder={t("chooseSubject")}
            value={subjectId}
            options={available.map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name }))}
            onChange={(e) => setSubjectId(e.target.value)}
            fieldClassName="sm:max-w-xs sm:flex-1"
            aria-label={t("subjectFor", { name: setupClass.name })}
          />
          <Button size="sm" variant="secondary" disabled={!subjectId} loading={adding} onClick={() => void add()}>
            {t("addSubject")}
          </Button>
        </div>
      ) : null}
    </li>
  );
};

/** Step 3: the classes (courses) and the subjects taught in each. A new class gets section "A". */
const SetupClassesStep = ({ organizationId }: { organizationId: string }) => {
  const t = useTranslations("academics.setup.classes");
  const { baseUrl, run } = useAcademicsRequest();
  const [classes, setClasses] = useState<SetupClass[] | null>(null);
  const [subjects, setSubjects] = useState<OrganizationSubjectItem[]>([]);
  const [className, setClassName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [saving, setSaving] = useState<"class" | "subject" | null>(null);

  const fetchClasses = useCallback(
    () => run(() => axiosReq.get<ApiResponse<AcademicSetupSummary>>(`${baseUrl}/setup`)).then((res) => res?.data?.payload?.classes ?? []),
    [baseUrl, run],
  );
  const fetchSubjects = useCallback(
    () =>
      run(() => axiosReq.get<ApiResponse<OrganizationSubjectItem[]>>(`${baseUrl}/organizations/${organizationId}/subjects`)).then(
        (res) => res?.data?.payload ?? [],
      ),
    [baseUrl, organizationId, run],
  );

  useEffect(() => {
    void fetchClasses().then(setClasses);
    void fetchSubjects().then(setSubjects);
  }, [fetchClasses, fetchSubjects]);

  const addClass = async () => {
    setSaving("class");
    const saved = await run(() => axiosReq.post(`${baseUrl}/classes`, { class_name: className.trim() }), t("classAdded"));
    setSaving(null);
    if (!saved) return;
    setClassName("");
    void fetchClasses().then(setClasses);
  };

  const addSubject = async () => {
    setSaving("subject");
    const saved = await run(
      () => axiosReq.post(`${baseUrl}/organizations/${organizationId}/subjects`, { name: subjectName.trim(), code: subjectCode.trim() }),
      t("subjectCreated"),
    );
    setSaving(null);
    if (!saved) return;
    setSubjectName("");
    setSubjectCode("");
    void fetchSubjects().then(setSubjects);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card title={t("title")} description={t("intro")}>
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void addClass();
            }}
          >
            <Input
              label={t("className")}
              placeholder={t("classNamePlaceholder")}
              value={className}
              maxLength={100}
              fieldClassName="sm:flex-1"
              onChange={(e) => setClassName(e.target.value)}
            />
            <Button type="submit" disabled={!className.trim()} loading={saving === "class"}>
              {t("addClass")}
            </Button>
          </form>

          {classes === null ? (
            <Skeleton lines={3} />
          ) : classes.length === 0 ? (
            <EmptyState title={t("empty")} description={t("emptyDetail")} />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {classes.map((setupClass) => (
                <ClassSubjectsRow key={setupClass.id} setupClass={setupClass} subjects={subjects} onChanged={() => void fetchClasses().then(setClasses)} />
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card title={t("newSubject")} description={t("newSubjectIntro")}>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void addSubject();
          }}
        >
          <Input label={t("subjectName")} value={subjectName} maxLength={100} fieldClassName="sm:flex-1" onChange={(e) => setSubjectName(e.target.value)} />
          <Input label={t("subjectCode")} value={subjectCode} maxLength={20} fieldClassName="sm:w-32" onChange={(e) => setSubjectCode(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={!subjectName.trim() || !subjectCode.trim()} loading={saving === "subject"}>
            {t("createSubject")}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default SetupClassesStep;
