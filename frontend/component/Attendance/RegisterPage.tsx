"use client";

import { AxiosError } from "axios";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ChevronLeftIcon, ChevronRightIcon, EmptyState, ErrorState, IconButton, PageHeader, Select, Skeleton, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { downloadCsv, isRegisterError, registerCsv, registerFileName } from "@/utils/attendance/paperRegister";
import { shiftMonth } from "@/utils/attendance/status";
import RegisterImportDrawer from "./RegisterImportDrawer";

type StudentRow = PaperRegisterView["students"][number];

/**
 * The monthly register of a section (ATT-17, ATT-13): pick a section and a month, download the
 * template (roll number, name, one column per class day) or the filled-in register as CSV (the same
 * format), and, for a paper-register section, import the filled-in file after a check. The page
 * shows each student's counts for the month; the full grid is in the CSV.
 */
const RegisterPage = () => {
  const t = useTranslations("register");
  const format = useFormat();
  const locale = useLocale();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const tErrors = useTranslations("register.errors");
  const [sections, setSections] = useState<PaperRegisterSection[] | null>(null);
  const [sectionsFailed, setSectionsFailed] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [register, setRegister] = useState<PaperRegisterView | null>(null);
  const [registerFailed, setRegisterFailed] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchSections = useCallback(() => axiosReq.get<ApiResponse<PaperRegisterSection[]>>(`${baseUrl}/attendance/register/sections`), [baseUrl]);
  // Without a month yet, ask for the current one; the API's "today" then sets the month shown.
  const wanted = month ?? new Date().toISOString().slice(0, 7);
  const fetchRegister = useCallback(
    () => axiosReq.get<ApiResponse<PaperRegisterView>>(`${baseUrl}/attendance/register/sections/${sectionId}`, { params: { month: wanted } }),
    [baseUrl, sectionId, wanted],
  );

  const gotSections = useCallback((list: PaperRegisterSection[]) => {
    setSections(list);
    setSectionsFailed(false);
    // Start with the first paper-register section (the ones that need an import), else the first one.
    setSectionId((current) => current || (list.find((section) => section.mode === "PAPER_REGISTER") ?? list[0])?.id || "");
  }, []);
  const gotRegister = useCallback(
    (payload: PaperRegisterView | null) => {
      if (payload && !month && payload.today.slice(0, 7) !== wanted) return setMonth(payload.today.slice(0, 7));
      setRegister(payload);
      setRegisterFailed(false);
    },
    [month, wanted],
  );
  const registerFailedWith = useCallback(
    (error: AxiosError<ApiError>) => {
      setRegisterFailed(true);
      const code = error.response?.data?.code;
      if (isRegisterError(code)) triggerToast({ title: tErrors(code), type: "error" });
      else handleError(error);
    },
    [handleError, tErrors, triggerToast],
  );

  const loadSections = async () => {
    try {
      gotSections((await fetchSections()).data?.payload ?? []);
    } catch (error) {
      setSectionsFailed(true);
      handleError(error as AxiosError<ApiError>);
    }
  };
  const loadRegister = async () => {
    try {
      gotRegister((await fetchRegister()).data?.payload ?? null);
    } catch (error) {
      registerFailedWith(error as AxiosError<ApiError>);
    }
  };

  useEffect(() => {
    let live = true;
    fetchSections()
      .then((response) => live && gotSections(response.data?.payload ?? []))
      .catch((error: AxiosError<ApiError>) => {
        if (!live) return;
        setSectionsFailed(true);
        handleError(error);
      });
    return () => {
      live = false;
    };
  }, [fetchSections, gotSections, handleError]);

  useEffect(() => {
    if (!sectionId) return;
    let live = true;
    fetchRegister()
      .then((response) => live && gotRegister(response.data?.payload ?? null))
      .catch((error: AxiosError<ApiError>) => live && registerFailedWith(error));
    return () => {
      live = false;
    };
  }, [fetchRegister, gotRegister, registerFailedWith, sectionId]);

  // The register of the chosen section and month (an older one is not shown while the next loads).
  const shown = register && register.section.id === sectionId && (!month || register.month === month) ? register : null;
  const shownMonth = shown?.month ?? month;
  const language = locale === "bn" ? "bn" : "en";
  const download = (withMarks: boolean) => {
    if (!shown) return;
    downloadCsv(registerFileName(shown, withMarks ? "register" : "template"), registerCsv(shown, language, { withMarks }));
  };

  const held = (shown?.classes ?? []).map((item) => item.date <= (shown?.today ?? ""));
  const count = (row: StudentRow, status: AttendanceStatus) => row.marks.filter((mark) => mark === status).length;
  const columns: TableColumn<StudentRow>[] = [
    { key: "roll", header: t("columns.roll"), cell: (row) => row.roll_no ?? "—", sortValue: (row) => Number(row.roll_no) || row.roll_no || "" },
    { key: "name", header: t("columns.name"), cell: (row) => <span className="font-medium text-ink">{row.full_name}</span>, sortValue: (row) => row.full_name },
    ...(["PRESENT", "LATE", "ABSENT", "LEAVE"] as const).map(
      (status): TableColumn<StudentRow> => ({
        key: status,
        header: t(`columns.${status}`),
        align: "right",
        cell: (row) => format.number(count(row, status)),
        sortValue: (row) => count(row, status),
      }),
    ),
    {
      key: "missing",
      header: t("columns.missing"),
      align: "right",
      cell: (row) => {
        const missing = row.marks.filter((mark, index) => mark === null && held[index]).length;
        return missing > 0 ? <Badge>{format.number(missing)}</Badge> : format.number(0);
      },
    },
  ];

  const section = sections?.find((item) => item.id === sectionId);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} />

      {sectionsFailed && !sections ? (
        <ErrorState title={t("loadFailed")} onRetry={() => void loadSections()} />
      ) : !sections ? (
        <div aria-busy="true">
          <Skeleton lines={3} />
        </div>
      ) : sections.length === 0 ? (
        <EmptyState title={t("noSections")} description={t("noSectionsHint")} />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Select
              label={t("section")}
              fieldClassName="sm:w-72"
              placeholder={false}
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
              options={sections.map((item) => ({
                value: item.id,
                label: `${item.class_name} ${item.name} · ${t(`mode.${item.mode}`)}`,
              }))}
            />
            {shownMonth ? (
              <div className="flex items-center gap-2">
                <IconButton label={t("previousMonth")} icon={<ChevronLeftIcon />} variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(shownMonth, -1))} />
                <span className="min-w-28 text-center text-body-sm font-medium text-ink" aria-live="polite">
                  {format.date(`${shownMonth}-01T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" })}
                </span>
                <IconButton label={t("nextMonth")} icon={<ChevronRightIcon />} variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(shownMonth, 1))} />
              </div>
            ) : null}
          </div>

          <Card
            title={section ? `${section.class_name} ${section.name}` : undefined}
            description={
              shown
                ? shown.can_import
                  ? t("paperHint", { classes: shown.classes.length, students: shown.students.length })
                  : t("selfHint", { classes: shown.classes.length, students: shown.students.length })
                : undefined
            }
            actions={
              shown ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => download(false)} disabled={shown.classes.length === 0}>
                    {t("template")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => download(true)} disabled={shown.classes.length === 0}>
                    {t("export")}
                  </Button>
                  {shown.can_import ? (
                    <Button size="sm" onClick={() => setImporting(true)} disabled={shown.classes.length === 0}>
                      {t("import")}
                    </Button>
                  ) : null}
                </div>
              ) : undefined
            }
          >
            {registerFailed && !shown ? (
              <ErrorState title={t("loadFailed")} onRetry={() => void loadRegister()} />
            ) : !shown ? (
              <div aria-busy="true">
                <Skeleton lines={5} />
              </div>
            ) : shown.classes.length === 0 ? (
              <EmptyState title={t("noClasses")} description={t("noClassesHint")} />
            ) : (
              <Table caption={t("tableCaption")} columns={columns} rows={shown.students} getRowId={(row) => row.id} empty={<EmptyState title={t("noStudents")} />} />
            )}
          </Card>
        </>
      )}

      {shown?.can_import ? (
        <RegisterImportDrawer
          open={importing}
          register={shown}
          onClose={() => setImporting(false)}
          onImported={(summary) => {
            setImporting(false);
            triggerToast({ title: t("imported", { new: summary.new, changed: summary.changed + summary.check_ins }), type: "success" });
            void loadRegister();
          }}
        />
      ) : null}
    </div>
  );
};

export default RegisterPage;
