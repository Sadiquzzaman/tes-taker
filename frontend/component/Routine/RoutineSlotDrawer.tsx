"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, ConfirmDialog, Drawer, Input, Select, TimePicker } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";
import { type IsoDay, SCHOOL_WEEK } from "@/utils/schoolDate";
import { sectionLabel, useClock } from "./RoutineWeek";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

/** Refusals the form explains itself (messages `routine.errors`). */
const FORM_ERRORS = ["SCHEDULE_OVERLAP", "SCHEDULE_TIME_INVALID", "SCHEDULE_TOO_MANY", "ROUTINE_SUBJECT_INVALID", "ROUTINE_TEACHER_INVALID", "ROUTINE_NOT_FOUND"] as const;
type FormError = (typeof FORM_ERRORS)[number];
const isFormError = (code: unknown): code is FormError => (FORM_ERRORS as readonly unknown[]).includes(code);

interface RoutineSlotDrawerProps {
  routine: RoutineView;
  /** The slot to change, or null to add one. */
  slot: RoutineSlot | null;
  /** For a new slot: the section and day to start with. */
  start?: { section_id?: string; day_of_week?: number };
  teachers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Adds or changes one weekly slot (CAL-01): section, day, start and end, subject, teacher and room.
 * When the teacher or room is booked at that time (CAL-02) it lists the clashes and saves only
 * after "Save anyway". A slot can be removed after a confirmation.
 */
const RoutineSlotDrawer = ({ routine, slot, start, teachers, onClose, onSaved }: RoutineSlotDrawerProps) => {
  const t = useTranslations("routine");
  const clock = useClock();
  const { handleError } = useApiError();
  const [sectionId, setSectionId] = useState(slot?.section.id ?? start?.section_id ?? routine.sections[0]?.id ?? "");
  const [day, setDay] = useState(String(slot?.day_of_week ?? start?.day_of_week ?? SCHOOL_WEEK[0]));
  const [startTime, setStartTime] = useState(slot?.start_time ?? "");
  const [endTime, setEndTime] = useState(slot?.end_time ?? "");
  const [offeringId, setOfferingId] = useState(slot?.subject?.offering_id ?? "");
  const [teacherId, setTeacherId] = useState(slot?.teacher?.id ?? "");
  const [room, setRoom] = useState(slot?.room ?? "");
  const [error, setError] = useState<FormError | "TIMES_REQUIRED" | null>(null);
  const [clashes, setClashes] = useState<RoutineClash[] | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);

  const subjects = routine.subject_classes.filter((offering) => offering.section_id === sectionId);
  // A slot's own teacher stays a choice even if they are no longer in the list.
  const teacherChoices = slot?.teacher && !teachers.some((teacher) => teacher.id === slot.teacher?.id) ? [...teachers, { id: slot.teacher.id, name: slot.teacher.full_name }] : teachers;

  const chooseSubject = (value: string) => {
    setOfferingId(value);
    // The subject's own teacher is the usual choice.
    const own = routine.subject_classes.find((offering) => offering.offering_id === value)?.teacher_ids ?? [];
    if (!teacherId && own.length === 1) setTeacherId(own[0]);
  };

  const save = async (confirm: boolean) => {
    if (!startTime || !endTime) return setError("TIMES_REQUIRED");
    if (endTime <= startTime) return setError("SCHEDULE_TIME_INVALID");
    setError(null);
    setBusy(true);
    const body: RoutineSlotInput = {
      day_of_week: Number(day),
      start_time: startTime,
      end_time: endTime,
      offering_id: offeringId || null,
      teacher_id: teacherId || null,
      room: room.trim() || null,
      ...(confirm ? { confirm_clashes: true } : {}),
    };
    try {
      if (slot) await axiosReq.patch(`${baseUrl}/routine/slots/${slot.id}`, body);
      else await axiosReq.post(`${baseUrl}/routine/slots`, { ...body, section_id: sectionId });
      onSaved();
    } catch (err) {
      const data = (err as AxiosError<ApiError & { code?: string; details?: { clashes?: RoutineClash[] } }>).response?.data;
      if (data?.code === "ROUTINE_CLASH" && data.details?.clashes) setClashes(data.details.clashes);
      else if (isFormError(data?.code)) setError(data.code);
      else handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!slot) return;
    setBusy(true);
    try {
      await axiosReq.delete(`${baseUrl}/routine/slots/${slot.id}`);
      onSaved();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
      setRemoving(false);
    }
  };

  // Any change to the form makes earlier clashes out of date.
  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setClashes(null);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={slot ? t("editTitle") : t("addTitle")}
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          {slot ? (
            <Button variant="danger" onClick={() => setRemoving(true)} disabled={busy}>
              {t("remove")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            {clashes ? (
              <Button onClick={() => void save(true)} loading={busy}>
                {t("saveAnyway")}
              </Button>
            ) : (
              <Button onClick={() => void save(false)} loading={busy}>
                {t("save")}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label={t("section")}
          value={sectionId}
          disabled={Boolean(slot)}
          placeholder={false}
          options={routine.sections.map((section) => ({ value: section.id, label: sectionLabel(section) }))}
          onChange={(event) => {
            edit(setSectionId)(event.target.value);
            setOfferingId("");
          }}
        />
        <Select
          label={t("day")}
          value={day}
          placeholder={false}
          options={SCHOOL_WEEK.map((iso) => ({ value: String(iso), label: t(`days.${iso as IsoDay}`) }))}
          onChange={(event) => edit(setDay)(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TimePicker label={t("start")} value={startTime} onChange={edit(setStartTime)} />
          <TimePicker label={t("end")} value={endTime} onChange={edit(setEndTime)} />
        </div>
        <Select
          label={t("subject")}
          value={offeringId}
          placeholder={t("noSubject")}
          options={subjects.map((offering) => ({ value: offering.offering_id, label: offering.subject.name }))}
          onChange={(event) => chooseSubject(event.target.value)}
        />
        <Select
          label={t("teacher")}
          value={teacherId}
          placeholder={t("noTeacher")}
          options={teacherChoices.map((teacher) => ({ value: teacher.id, label: teacher.name }))}
          onChange={(event) => edit(setTeacherId)(event.target.value)}
        />
        <Input label={t("room")} hint={t("roomHint")} value={room} maxLength={40} list="routine-rooms" onChange={(event) => edit(setRoom)(event.target.value)} />
        <datalist id="routine-rooms">
          {routine.rooms.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {error ? (
          <p role="alert" className="text-body-sm text-danger">
            {t(`errors.${error}`, { max: 70 })}
          </p>
        ) : null}
        {clashes ? (
          <div role="alert" className="flex flex-col gap-2 rounded-input bg-warning-soft px-3 py-2 text-body-sm text-ink">
            <p className="font-medium">{t("clashTitle")}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {clashes.map((clash) => (
                <li key={`${clash.kind}-${clash.slot_id}`}>
                  {t(`clashWith.${clash.kind}`, {
                    section: sectionLabel(clash.section),
                    day: t(`days.${clash.day_of_week as IsoDay}`),
                    start: clock(clash.start_time),
                    end: clock(clash.end_time),
                  })}
                </li>
              ))}
            </ul>
            <p>{t("clashHint")}</p>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={removing}
        title={t("removeTitle")}
        description={t("removeDetail")}
        confirmLabel={t("remove")}
        tone="danger"
        loading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(false)}
      />
    </Drawer>
  );
};

export default RoutineSlotDrawer;
