"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Checkbox, DatePicker, Drawer, Input } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";

/** Add or edit a session: name and dates; a new one can become the default at once. */
const SessionFormDrawer = ({
  session,
  onClose,
  onSaved,
}: {
  /** The session to edit; null adds a new one. Mounted (with a key) only while open. */
  session: AcademicSession | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useTranslations("academics.sessions");
  const { baseUrl, run } = useAcademicsRequest();
  const [name, setName] = useState(session?.name ?? "");
  const [start, setStart] = useState(session?.start_date ?? "");
  const [end, setEnd] = useState(session?.end_date ?? "");
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const datesInvalid = Boolean(start && end && end < start);
  const canSave = name.trim() !== "" && start !== "" && end !== "" && !datesInvalid;

  const save = async () => {
    setSaving(true);
    const body = { name: name.trim(), start_date: start, end_date: end };
    const saved = await run(
      () =>
        session
          ? axiosReq.patch(`${baseUrl}/sessions/${session.id}`, body)
          : axiosReq.post(`${baseUrl}/sessions`, { ...body, is_default: makeDefault }),
      t("saved"),
    );
    setSaving(false);
    if (saved) onSaved();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={session ? t("edit") : t("add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={!canSave} loading={saving}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label={t("name")} placeholder={t("namePlaceholder")} value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
        <DatePicker label={t("start")} value={start} required onChange={setStart} />
        <DatePicker label={t("end")} value={end} min={start || undefined} required onChange={setEnd} error={datesInvalid ? t("datesInvalid") : undefined} />
        {session ? null : <Checkbox label={t("makeDefaultOnCreate")} checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />}
      </div>
    </Drawer>
  );
};

export default SessionFormDrawer;
