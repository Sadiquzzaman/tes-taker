"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Combobox, Drawer, Input, Select } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";

const SHIFTS: SectionShift[] = ["MORNING", "DAY", "EVENING"];

/** Add or edit a section: name, shift, room and (when the organisation uses them) its class teacher. */
const SectionFormDrawer = ({
  classId,
  sessionId,
  section,
  teachers,
  classTeacherEnabled,
  onClose,
  onSaved,
}: {
  classId: string;
  sessionId: string;
  /** The section to edit; null adds a new one. Mounted (with a key) only while open. */
  section: ClassSection | null;
  teachers: AcademicPerson[];
  classTeacherEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useTranslations("academics.sections");
  const { baseUrl, run } = useAcademicsRequest();
  const [name, setName] = useState(section?.name ?? "");
  const [shift, setShift] = useState<string>(section?.shift ?? "");
  const [room, setRoom] = useState(section?.room ?? "");
  const [classTeacherId, setClassTeacherId] = useState<string | null>(section?.class_teacher?.id ?? null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const body = {
      name: name.trim(),
      shift: shift || (section ? null : undefined),
      room: room.trim() || (section ? null : undefined),
      ...(classTeacherEnabled ? { class_teacher_id: classTeacherId ?? (section ? null : undefined) } : {}),
    };
    const saved = await run(
      () =>
        section
          ? axiosReq.patch(`${baseUrl}/sections/${section.id}`, body)
          : axiosReq.post(`${baseUrl}/classes/${classId}/sections`, { ...body, session_id: sessionId }),
      t("saved"),
    );
    setSaving(false);
    if (saved) onSaved();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={section ? t("edit") : t("add")}
      footer={
        <Button onClick={() => void save()} disabled={!name.trim()} loading={saving}>
          {section ? t("edit") : t("add")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label={t("name")} placeholder={t("namePlaceholder")} value={name} maxLength={60} required onChange={(e) => setName(e.target.value)} />
        <Select
          label={t("shift")}
          placeholder={t("noShift")}
          value={shift}
          options={SHIFTS.map((value) => ({ value, label: t(`shifts.${value}`) }))}
          onChange={(e) => setShift(e.target.value)}
        />
        <Input label={t("room")} value={room} maxLength={40} onChange={(e) => setRoom(e.target.value)} />
        {classTeacherEnabled ? (
          <Combobox
            label={t("classTeacher")}
            placeholder={t("noClassTeacher")}
            value={classTeacherId}
            options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.full_name }))}
            onChange={setClassTeacherId}
          />
        ) : null}
      </div>
    </Drawer>
  );
};

export default SectionFormDrawer;
