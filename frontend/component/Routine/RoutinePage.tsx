"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import useApiData from "@/component/Homework/useApiData";
import useIsStudent from "@/component/Homework/useIsStudent";
import { Button, Card, EmptyState, ErrorState, PageHeader, Select, Skeleton, Tabs } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";
import axiosReq from "@/lib/axios";
import RoutineSlotDrawer from "./RoutineSlotDrawer";
import RoutineWeek, { sectionLabel } from "./RoutineWeek";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

type ViewBy = "section" | "teacher" | "room";

/**
 * The weekly class routine (CAL-01, CAL-02). Everyone sees "My routine" (a student's sections, a
 * teacher's classes). Staff also see a session's whole routine by section, teacher or room, with
 * clashes marked; owners, admins and assistants add, change and remove classes there.
 */
const RoutinePage = () => {
  const t = useTranslations("routine");
  const isStudent = useIsStudent();

  if (isStudent === undefined) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={isStudent ? t("studentIntro") : t("staffIntro")} />
      {isStudent ? (
        <MyRoutine />
      ) : (
        <Tabs
          tabs={[
            { key: "whole", label: t("tabs.whole"), content: <WholeRoutine /> },
            { key: "mine", label: t("tabs.mine"), content: <MyRoutine /> },
          ]}
        />
      )}
    </div>
  );
};

/** The caller's own week (`GET /routine/mine`). */
const MyRoutine = () => {
  const t = useTranslations("routine");
  const { data: slots, failed, reload } = useApiData<RoutineSlot[]>("/routine/mine");
  return (
    <Card title={t("mineTitle")}>
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : slots === null ? (
        <Skeleton lines={4} />
      ) : slots.length === 0 ? (
        <EmptyState title={t("mineEmpty")} description={t("mineEmptyHint")} />
      ) : (
        <RoutineWeek slots={slots} show={{ section: true }} />
      )}
    </Card>
  );
};

/** A session's whole routine for staff, by section, teacher or room. */
const WholeRoutine = () => {
  const t = useTranslations("routine");
  const { triggerToast } = useToast();
  const { isIndividual, organizationId } = useWorkspace();
  const [sessionId, setSessionId] = useState("");
  const { data: routine, failed, reload } = useApiData<RoutineView>("/routine", { session_id: sessionId || undefined });
  const { data: sessions } = useApiData<AcademicSession[]>("/sessions");
  const [viewBy, setViewBy] = useState<ViewBy>("section");
  const [chosen, setChosen] = useState("");
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<{ slot: RoutineSlot | null; start?: { section_id?: string } } | null>(null);

  const canManage = routine?.can_manage ?? false;
  // Teachers to put on a slot: the organisation's teaching members.
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
      return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
    }
    return routine.rooms.map((room) => ({ value: room, label: room }));
  }, [routine, viewBy]);

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!routine) return <Skeleton lines={6} />;

  const current = choices.some((choice) => choice.value === chosen) ? chosen : (choices[0]?.value ?? "");
  const shown = routine.slots.filter((slot) =>
    viewBy === "section" ? slot.section.id === current : viewBy === "teacher" ? slot.teacher?.id === current : slot.room?.toLowerCase() === current.toLowerCase(),
  );
  const clashCount = routine.slots.filter((slot) => slot.clashes.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <Select
            label={t("session")}
            fieldClassName="md:w-56"
            value={sessionId || routine.session.id}
            placeholder={false}
            options={(sessions ?? [routine.session]).map((session) => ({ value: session.id, label: session.name }))}
            onChange={(event) => setSessionId(event.target.value)}
          />
          <Select
            label={t("viewBy")}
            fieldClassName="md:w-44"
            value={viewBy}
            placeholder={false}
            options={(["section", "teacher", "room"] as ViewBy[]).map((value) => ({ value, label: t(`by.${value}`) }))}
            onChange={(event) => {
              setViewBy(event.target.value as ViewBy);
              setChosen("");
            }}
          />
          <Select
            label={t(`by.${viewBy}`)}
            fieldClassName="md:w-64"
            value={current}
            placeholder={choices.length ? false : t("nothingToChoose")}
            options={choices}
            onChange={(event) => setChosen(event.target.value)}
          />
          {canManage ? (
            <Button className="md:ml-auto" onClick={() => setEditing({ slot: null, start: { section_id: viewBy === "section" ? current : undefined } })}>
              {t("add")}
            </Button>
          ) : null}
        </div>
        {clashCount > 0 ? (
          <p role="status" className="mt-3 rounded-input bg-warning-soft px-3 py-2 text-body-sm text-ink">
            {t("clashesInRoutine", { count: clashCount })}
          </p>
        ) : null}
      </Card>
      {routine.sections.length === 0 ? (
        <Card>
          <EmptyState title={t("noSections")} />
        </Card>
      ) : (
        <RoutineWeek slots={shown} show={{ section: viewBy !== "section", teacher: viewBy !== "teacher" }} onOpen={canManage ? (slot) => setEditing({ slot }) : undefined} />
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
    </div>
  );
};

export default RoutinePage;
