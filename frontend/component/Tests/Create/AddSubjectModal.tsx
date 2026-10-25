"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Input, Modal } from "@/design/ui";
import useCreateSubject from "@/hooks/api/subject/userCreateSubject";
import { setSingleSubject } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";

const EMPTY = { name: "", code: "" };

/** Add a new subject to the teacher's library (name and short code). */
const AddSubjectModal = ({ open, onClose, onCreated }: AddSubjectModalProps) => {
  const t = useTranslations("createTest.subjects");
  const dispatch = useAppDispatch();
  const [form, setForm] = useState(EMPTY);
  const [createSubject, { loading }] = useCreateSubject();

  const handleClose = () => {
    setForm(EMPTY);
    onClose();
  };

  const handleSubmit = async () => {
    const subject = await createSubject({ name: form.name, code: form.code });
    if (!subject) return;
    if (onCreated) {
      onCreated(subject);
    } else {
      dispatch(setSingleSubject(subject));
    }
    handleClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("newTitle")}
      description={t("newIntro")}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} loading={loading} disabled={!form.name.trim()}>
            {loading ? t("saving") : t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label={t("name")} required value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder={t("namePlaceholder")} />
        <Input
          label={t("code")}
          value={form.code}
          onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
          placeholder={t("codePlaceholder")}
          className="uppercase"
        />
      </div>
    </Modal>
  );
};

export default AddSubjectModal;
