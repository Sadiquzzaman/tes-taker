"use client";

import { AxiosError } from "axios";
import { useLocale, useTranslations } from "next-intl";
import NextLink from "next/link";
import { useEffect, useMemo, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import useIsStudent from "@/component/Homework/useIsStudent";
import { useToast } from "@/component/Toast/ToastContext";
import { buttonClasses, Button, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, Select, Skeleton, Textarea } from "@/design/ui";
import { cn, focusRing } from "@/design/ui/cn";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

type Remarks = { teacher: string; principal: string };

/**
 * Report cards (P7-04, PRF-09). Staff choose a section, a term and the card's language, write
 * each student's remarks (the principal's remark is for owners and admins), make the cards and
 * print one or the whole section as one PDF. A card keeps the scores it was made with; making it
 * again after a change adds a version. Students see their own cards.
 */
const ReportCardsPage = () => {
  const isStudent = useIsStudent();
  if (isStudent === undefined) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }
  return isStudent ? <MyCards /> : <StaffCards />;
};

const MyCards = () => {
  const t = useTranslations("reportCards");
  const format = useFormat();
  const { data, failed, reload } = useApiData<ReportCardSummary[]>("/report-cards/mine");
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("myTitle")} description={t("myIntro")} />
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : !data ? (
        <Card aria-busy="true">
          <Skeleton lines={3} />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState title={t("myEmpty")} description={t("myEmptyHint")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((card) => (
            <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
              <span className="flex flex-col gap-1">
                <span className="text-title-sm font-semibold text-ink">{card.term?.name ?? t("wholeSession")}</span>
                <span className="text-body-sm text-ink-muted">{t("madeOn", { date: format.date(card.generated_at, { day: "numeric", month: "long", year: "numeric" }) })}</span>
              </span>
              <NextLink href={`/report-cards/${card.id}?locale=${card.locale}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                {t("open")}
              </NextLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const StaffCards = () => {
  const t = useTranslations("reportCards");
  const { data: visible, failed, reload } = useApiData<VisibleScoreSections>("/scores/sections");
  const [chosenSection, setChosenSection] = useState("");
  const [termId, setTermId] = useState("");
  const appLocale = useLocale();
  const [locale, setLocale] = useState<"bn" | "en">(appLocale === "en" ? "en" : "bn");
  const sectionId = visible?.sections.some((s) => s.id === chosenSection) ? chosenSection : (visible?.sections[0]?.id ?? "");
  const validTerm = visible?.terms.some((term) => term.id === termId) ? termId : "";

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} />
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : !visible ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : visible.sections.length === 0 ? (
        <Card>
          <EmptyState title={t("noSections")} description={t("noSectionsHint")} />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label={t("section")}
              fieldClassName="sm:w-56"
              placeholder={false}
              value={sectionId}
              onChange={(event) => setChosenSection(event.target.value)}
              options={visible.sections.map((s) => ({ value: s.id, label: `${s.class_name} ${s.name}`.trim() }))}
            />
            {visible.terms.length ? (
              <Select
                label={t("term")}
                fieldClassName="sm:w-48"
                placeholder={t("wholeSession")}
                value={validTerm}
                onChange={(event) => setTermId(event.target.value)}
                options={visible.terms.map((term) => ({ value: term.id, label: term.name }))}
              />
            ) : null}
            <Select
              label={t("language")}
              fieldClassName="sm:w-40"
              placeholder={false}
              value={locale}
              onChange={(event) => setLocale(event.target.value as "bn" | "en")}
              options={[
                { value: "bn", label: t("languages.bn") },
                { value: "en", label: t("languages.en") },
              ]}
            />
          </div>
          <SectionCards key={`${sectionId}:${validTerm}`} sectionId={sectionId} termId={validTerm} locale={locale} />
        </>
      )}
    </div>
  );
};

const SectionCards = ({ sectionId, termId, locale }: { sectionId: string; termId: string; locale: "bn" | "en" }) => {
  const t = useTranslations("reportCards");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data, failed, reload, setData } = useApiData<ReportCardList>("/report-cards", { section_id: sectionId, term_id: termId || undefined });
  const [remarks, setRemarks] = useState<Record<string, Remarks>>({});
  const [making, setMaking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);

  useEffect(() => {
    if (data) setRemarks(Object.fromEntries(data.rows.map((row) => [row.student.id, { teacher: row.latest?.teacher_remark ?? "", principal: row.latest?.principal_remark ?? "" }])));
  }, [data]);

  const made = useMemo(() => data?.rows.filter((row) => row.latest).length ?? 0, [data]);
  const query = `section_id=${sectionId}${termId ? `&term_id=${termId}` : ""}&locale=${locale}`;

  const make = async () => {
    if (!data) return;
    setMaking(true);
    try {
      const rows = data.rows.map((row) => ({
        student_id: row.student.id,
        teacher_remark: remarks[row.student.id]?.teacher ?? "",
        ...(data.can_write_principal_remark ? { principal_remark: remarks[row.student.id]?.principal ?? "" } : {}),
      }));
      const before = new Map(data.rows.map((row) => [row.student.id, row.latest?.version ?? 0]));
      const response = await axiosReq.post<ApiResponse<ReportCardList>>(`${process.env.NEXT_PUBLIC_BASE_URL}/report-cards/generate`, { section_id: sectionId, term_id: termId || undefined, locale, rows });
      setData(response.data.payload);
      const changed = response.data.payload.rows.filter((row) => (row.latest?.version ?? 0) !== before.get(row.student.id)).length;
      triggerToast({ title: t("madeToast", { count: changed }), type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setMaking(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      const response = await axiosReq.post<ApiResponse<{ cards: number; guardian_sms: number }>>(`${process.env.NEXT_PUBLIC_BASE_URL}/report-cards/share`, {
        section_id: sectionId,
        term_id: termId || undefined,
      });
      triggerToast({
        title: t("sharedToast", { count: response.data.payload.cards }),
        description: t("sharedSms", { count: response.data.payload.guardian_sms }),
        type: "success",
      });
      reload();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setSharing(false);
      setConfirmShare(false);
    }
  };

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={6} />
      </Card>
    );
  }
  if (data.rows.length === 0) {
    return (
      <Card>
        <EmptyState title={t("noStudents")} />
      </Card>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-ink-muted">{t("madeCount", { made, total: data.rows.length })}</p>
        <div className="flex flex-wrap gap-2">
          <a href={`/report-cards/print?${query}`} target="_blank" rel="noreferrer" aria-disabled={made === 0} className={cn(buttonClasses({ variant: "secondary" }), made === 0 && "pointer-events-none opacity-50")}>
            {t("printAll")}
          </a>
          <Button variant="secondary" loading={sharing} disabled={made === 0} onClick={() => setConfirmShare(true)}>
            {t("share")}
          </Button>
          <Button loading={making} onClick={() => void make()}>
            {t("make")}
          </Button>
        </div>
      </div>
      <p className="text-body-sm text-ink-muted">{t("makeHint")}</p>
      <Card flush>
        <ul className="divide-y divide-border">
          {data.rows.map((row) => (
            <li key={row.student.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start">
              <div className="flex min-w-48 flex-col gap-1">
                <span className="font-medium text-ink">
                  {row.student.roll_no ? `${row.student.roll_no}. ` : ""}
                  {row.student.full_name}
                </span>
                {row.latest ? (
                  <span className="text-caption text-ink-muted">
                    {t("version", { version: format.number(row.latest.version), date: format.date(row.latest.generated_at, { day: "numeric", month: "short", year: "numeric" }) })}{" "}
                    <NextLink href={`/report-cards/${row.latest.id}?locale=${row.latest.locale}`} target="_blank" className={cn("text-primary underline-offset-2 hover:underline", focusRing)}>
                      {t("openFor", { name: row.student.full_name })}
                    </NextLink>
                    {row.latest.share_expires_at && new Date(row.latest.share_expires_at) > new Date() ? (
                      <span className="block">{t("sharedUntil", { date: format.date(row.latest.share_expires_at, { day: "numeric", month: "short", year: "numeric" }) })}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-caption text-ink-muted">{t("notMade")}</span>
                )}
              </div>
              <Textarea
                label={t("teacherRemarkFor", { name: row.student.full_name })}
                fieldClassName="flex-1"
                rows={2}
                maxLength={500}
                value={remarks[row.student.id]?.teacher ?? ""}
                onChange={(event) => setRemarks((all) => ({ ...all, [row.student.id]: { ...all[row.student.id], teacher: event.target.value } }))}
              />
              {data.can_write_principal_remark ? (
                <Textarea
                  label={t("principalRemarkFor", { name: row.student.full_name })}
                  fieldClassName="flex-1"
                  rows={2}
                  maxLength={500}
                  value={remarks[row.student.id]?.principal ?? ""}
                  onChange={(event) => setRemarks((all) => ({ ...all, [row.student.id]: { ...all[row.student.id], principal: event.target.value } }))}
                />
              ) : (
                <p className="flex-1 text-body-sm text-ink-muted">{row.latest?.principal_remark ? t("principalSaid", { remark: row.latest.principal_remark }) : t("principalLater")}</p>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <ConfirmDialog
        open={confirmShare}
        title={t("shareTitle")}
        description={t("shareDetail", { count: made })}
        confirmLabel={t("share")}
        onConfirm={() => void share()}
        onCancel={() => setConfirmShare(false)}
      />
    </>
  );
};

export default ReportCardsPage;
