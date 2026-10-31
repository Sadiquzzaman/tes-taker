"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Drawer, EmptyState, Input, RadioGroup, Select, Skeleton } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";
import { GUARDIAN_RELATIONS, MAX_GUARDIANS, guardianErrors, type GuardianDraft } from "@/utils/academics/guardians";

const LANGUAGES: OrganizationLocale[] = ["bn", "en"];
/** The Select value for "follow the organisation". */
const ORG_DEFAULT = "default";

const toDraft = (guardian: Guardian): GuardianDraft => ({ ...guardian });

/**
 * A student's guardians (FND-09): up to 2, one primary, Bangladeshi mobile numbers; and the
 * student's SMS language (FND-10). Saved as a whole; a guardian taken out is removed but kept in
 * the history. Owners, admins, assistants and the student's teachers can open it (the API checks).
 */
const GuardiansDrawer = ({ enrolmentId, studentName, onClose }: { enrolmentId: string; studentName: string; onClose: () => void }) => {
  const t = useTranslations("academics.guardians");
  const tLanguages = useTranslations("academics.settings.languages");
  const { baseUrl, run } = useAcademicsRequest();
  const [loaded, setLoaded] = useState<StudentGuardians | null>(null);
  const [drafts, setDrafts] = useState<GuardianDraft[]>([]);
  const [smsLocale, setSmsLocale] = useState<string>(ORG_DEFAULT);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  // The latest onClose, so a parent re-render does not load the guardians again.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  const apply = useCallback((data: StudentGuardians) => {
    setLoaded(data);
    setDrafts(data.guardians.map(toDraft));
    setSmsLocale(data.sms_locale ?? ORG_DEFAULT);
    setShowErrors(false);
  }, []);

  useEffect(() => {
    void run(() => axiosReq.get<ApiResponse<StudentGuardians>>(`${baseUrl}/enrolments/${enrolmentId}/guardians`)).then((res) => {
      // Not allowed or not found: the error is shown and the drawer closes.
      if (res?.data?.payload) apply(res.data.payload);
      else closeRef.current();
    });
  }, [apply, baseUrl, enrolmentId, run]);

  const errors = guardianErrors(drafts);
  const hasErrors = errors.some((e) => e.name || e.phone);

  const change = (index: number, patch: Partial<GuardianDraft>) =>
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  const makePrimary = (index: number) => setDrafts((current) => current.map((draft, i) => ({ ...draft, is_primary: i === index })));
  const add = () =>
    setDrafts((current) => [...current, { name: "", relation: current.length === 0 ? "FATHER" : "MOTHER", phone: "", is_primary: current.length === 0 }]);
  const remove = (index: number) =>
    setDrafts((current) => {
      const next = current.filter((_, i) => i !== index);
      // Someone stays primary.
      if (next.length > 0 && !next.some((draft) => draft.is_primary)) next[0] = { ...next[0], is_primary: true };
      return next;
    });

  const save = async () => {
    setShowErrors(true);
    if (hasErrors) return;
    setSaving(true);
    const res = await run(
      () =>
        axiosReq.put<ApiResponse<StudentGuardians>>(`${baseUrl}/enrolments/${enrolmentId}/guardians`, {
          guardians: drafts.map(({ id, name, relation, phone, is_primary }) => ({ ...(id ? { id } : {}), name: name.trim(), relation, phone, is_primary })),
          sms_locale: smsLocale === ORG_DEFAULT ? null : smsLocale,
        }),
      t("saved"),
    );
    setSaving(false);
    if (res?.data?.payload) apply(res.data.payload);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("title", { name: studentName })}
      description={t("intro")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!loaded}>
            {t("save")}
          </Button>
        </>
      }
    >
      {!loaded ? (
        <Skeleton lines={4} />
      ) : (
        <div className="flex flex-col gap-6">
          {drafts.length === 0 ? <EmptyState title={t("empty")} /> : null}
          {drafts.map((draft, index) => (
            <fieldset key={draft.id ?? `new-${index}`} className="flex flex-col gap-3 rounded-card border border-border p-4">
              <legend className="px-1 text-body-sm font-medium text-ink">{t("guardianN", { n: index + 1 })}</legend>
              <Input
                label={t("name")}
                value={draft.name}
                maxLength={120}
                required
                error={showErrors && errors[index].name ? t(errors[index].name) : undefined}
                onChange={(e) => change(index, { name: e.target.value })}
              />
              <Select
                label={t("relation")}
                placeholder={false}
                value={draft.relation}
                options={GUARDIAN_RELATIONS.map((value) => ({ value, label: t(`relations.${value}`) }))}
                onChange={(e) => change(index, { relation: e.target.value as GuardianRelation })}
              />
              <Input
                label={t("phone")}
                hint={t("phoneHint")}
                type="tel"
                inputMode="tel"
                value={draft.phone}
                maxLength={20}
                required
                error={showErrors && errors[index].phone ? t(errors[index].phone) : undefined}
                onChange={(e) => change(index, { phone: e.target.value })}
              />
              <Button
                variant="ghost"
                size="sm"
                className="self-end text-danger"
                aria-label={t("removeFor", { n: index + 1 })}
                onClick={() => remove(index)}
              >
                {t("remove")}
              </Button>
            </fieldset>
          ))}
          {drafts.length > 1 ? (
            <RadioGroup
              legend={t("primary")}
              name={`primary-${enrolmentId}`}
              options={drafts.map((draft, index) => ({
                value: String(index),
                label: draft.name.trim() || t("guardianN", { n: index + 1 }),
              }))}
              value={String(drafts.findIndex((draft) => draft.is_primary))}
              onChange={(value) => makePrimary(Number(value))}
            />
          ) : null}
          {drafts.length < MAX_GUARDIANS ? (
            <Button variant="secondary" onClick={add} className="self-start">
              {t("add")}
            </Button>
          ) : null}
          <Select
            label={t("smsLanguage")}
            hint={t("smsHint")}
            placeholder={false}
            value={smsLocale}
            options={[
              { value: ORG_DEFAULT, label: t("smsDefault", { language: tLanguages(loaded.organization_sms_locale) }) },
              ...LANGUAGES.map((value) => ({ value, label: tLanguages(value) })),
            ]}
            onChange={(e) => setSmsLocale(e.target.value)}
          />
        </div>
      )}
    </Drawer>
  );
};

export default GuardiansDrawer;
