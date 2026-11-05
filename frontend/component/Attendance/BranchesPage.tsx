"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
  StatusPill,
  Table,
  type TableColumn,
} from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import LocationFields, { LocationDraft, locationBody, locationDraftOf, locationProblems } from "./LocationFields";

const ERROR_CODES = [
  "ATTENDANCE_BRANCH_NAME_REQUIRED",
  "ATTENDANCE_BRANCH_NAME_TAKEN",
  "ATTENDANCE_BRANCH_PIN_INCOMPLETE",
  "ATTENDANCE_BRANCH_DEFAULT_KEPT",
  "ATTENDANCE_BRANCH_IN_USE",
  "ATTENDANCE_BRANCHES_NOT_FOR_SOLO",
] as const;
type ErrorCode = (typeof ERROR_CODES)[number];
const isErrorCode = (code: unknown): code is ErrorCode => ERROR_CODES.includes(code as ErrorCode);

interface Draft {
  /** null for a new branch. */
  branch: Branch | null;
  name: string;
  address: string;
  location: LocationDraft;
}

/**
 * Branches with their check-in pin and radius (ATT-15). The main branch is always there (it holds the
 * organisation's own pin) and cannot be removed; it is called "Main branch" until it is given a name.
 * Owners and admins add, change and remove branches; removing keeps the record and is refused while
 * sections of an open session meet there.
 */
const BranchesPage = () => {
  const t = useTranslations("branches");
  const format = useFormat();
  const { baseUrl, run, canManageSessions: canEdit } = useAcademicsRequest();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<ErrorCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Branch | null>(null);
  const [removeProblem, setRemoveProblem] = useState<ErrorCode | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const payload = await run(async () => (await axiosReq.get<ApiResponse<Branch[]>>(`${baseUrl}/attendance/branches`)).data?.payload ?? null);
    if (payload) setBranches(payload);
    else setFailed(true);
  }, [baseUrl, run]);

  useEffect(() => {
    void load();
  }, [load]);

  const main = branches?.find((branch) => branch.is_default);
  const nameOf = (branch: Branch) => branch.name ?? t("mainBranch");

  const openAdd = () => {
    setProblem(null);
    setDraft({ branch: null, name: "", address: "", location: { lat: "", lng: "", radius: String(main?.checkin_radius_m ?? 100) } });
  };

  const openEdit = (branch: Branch) => {
    setProblem(null);
    setDraft({ branch, name: branch.name ?? "", address: branch.address ?? "", location: locationDraftOf(branch) });
  };

  const nameMissing = draft !== null && !draft.branch?.is_default && !draft.name.trim();
  const locationInvalid = draft !== null && Object.keys(locationProblems(draft.location)).length > 0;

  const save = async () => {
    if (!draft) return;
    if (nameMissing) {
      setProblem("ATTENDANCE_BRANCH_NAME_REQUIRED");
      return;
    }
    if (locationInvalid) return;
    setSaving(true);
    const body = { name: draft.name.trim(), address: draft.address.trim() || null, ...locationBody(draft.location) };
    try {
      if (draft.branch) await axiosReq.patch(`${baseUrl}/attendance/branches/${draft.branch.id}`, body);
      else await axiosReq.post(`${baseUrl}/attendance/branches`, body);
      triggerToast({ title: draft.branch ? t("updated") : t("added"), type: "success" });
      setDraft(null);
      void load();
    } catch (error) {
      const code = (error as AxiosError<ApiError>).response?.data?.code;
      if (isErrorCode(code)) setProblem(code);
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);
    try {
      await axiosReq.delete(`${baseUrl}/attendance/branches/${removing.id}`);
      triggerToast({ title: t("removed"), type: "success" });
      setRemoving(null);
      void load();
    } catch (error) {
      const code = (error as AxiosError<ApiError>).response?.data?.code;
      if (isErrorCode(code)) setRemoveProblem(code);
      else {
        handleError(error as AxiosError<ApiError>);
        setRemoving(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<Branch>[] = [
    {
      key: "name",
      header: t("name"),
      cell: (branch) => (
        <span className="inline-flex flex-wrap items-center gap-2 font-medium text-ink">
          {nameOf(branch)}
          {branch.is_default ? <Badge tone="neutral">{t("main")}</Badge> : null}
        </span>
      ),
    },
    { key: "address", header: t("address"), cell: (branch) => branch.address ?? <span className="text-ink-muted">—</span> },
    {
      key: "pin",
      header: t("pin"),
      cell: (branch) =>
        branch.geo_lat === null ? (
          <StatusPill tone="warning">{t("noPin")}</StatusPill>
        ) : (
          <StatusPill tone="success">{t("radiusShort", { radius: format.number(branch.checkin_radius_m) })}</StatusPill>
        ),
    },
    {
      key: "sections",
      header: t("sections"),
      align: "right",
      cell: (branch) => format.number(branch.section_count),
      sortValue: (branch) => branch.section_count,
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: t("actions"),
            align: "right" as const,
            cell: (branch: Branch) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(branch)} aria-label={t("editNamed", { name: nameOf(branch) })}>
                  {t("edit")}
                </Button>
                {!branch.is_default ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRemoveProblem(null);
                      setRemoving(branch);
                    }}
                    aria-label={t("removeNamed", { name: nameOf(branch) })}
                  >
                    {t("remove")}
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} actions={canEdit ? <Button onClick={openAdd}>{t("add")}</Button> : undefined} />

      <Card>
        {failed ? (
          <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
        ) : !branches ? (
          <div aria-busy="true">
            <Skeleton lines={4} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Table caption={t("title")} columns={columns} rows={branches} getRowId={(branch) => branch.id} />
            {branches.length === 1 ? <p className="text-body-sm text-ink-muted">{t("onlyMain")}</p> : null}
          </div>
        )}
      </Card>

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.branch ? t("editTitle", { name: nameOf(draft.branch) }) : t("addTitle")}
        description={t("formHint")}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="submit" form="branch-form" loading={saving} disabled={locationInvalid}>
              {draft?.branch ? t("saveChanges") : t("add")}
            </Button>
          </div>
        }
      >
        {draft ? (
          <form
            id="branch-form"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Input
              label={t("name")}
              hint={draft.branch?.is_default ? t("mainNameHint") : undefined}
              value={draft.name}
              maxLength={120}
              required={!draft.branch?.is_default}
              autoComplete="off"
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
                setProblem(null);
              }}
            />
            <Input
              label={t("address")}
              hint={t("addressHint")}
              value={draft.address}
              maxLength={300}
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, address: event.target.value })}
            />
            <LocationFields value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />
            {problem ? (
              <p role="alert" className="text-body-sm text-danger">
                {t(`errors.${problem}`)}
              </p>
            ) : null}
          </form>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={removing !== null}
        title={t("removeTitle")}
        description={
          removing
            ? removeProblem
              ? t(`errors.${removeProblem}`)
              : t("removeDescription", { name: nameOf(removing) })
            : undefined
        }
        confirmLabel={t("remove")}
        loading={saving}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
};

export default BranchesPage;
