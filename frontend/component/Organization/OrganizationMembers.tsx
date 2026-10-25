"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  FilterBar,
  Input,
  PageHeader,
  Skeleton,
  Table,
  Textarea,
  type TableColumn,
} from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { downloadStudentCsvTemplate, extractStudentsFromCsvRows, parseCsvText } from "@/utils/classes/addStudentModal";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";

type AddableRole = "TEACHER" | "ASSISTANT" | "STUDENT";

type LookupPayload =
  | {
      found: false;
      query: string;
      query_type: string;
      message: string;
    }
  | {
      found: true;
      query: string;
      query_type: string;
      user: {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        teacher_public_id: string | null;
        student_public_id: string | null;
        is_otp_verified: boolean;
      };
      membership: {
        id: string;
        role: OrganizationMemberRole;
        is_active: number;
        removed_at?: string | null;
      } | null;
    };

type AddMemberPayload =
  | { status: "added"; member: OrganizationMemberItem }
  | {
      status: "invited";
      invitation: {
        id: string;
        role: OrganizationMemberRole;
        invited_phone: string | null;
        invited_email: string | null;
        status: string;
        expires_at?: string | null;
      };
    };

type ImportResultPayload = {
  total: number;
  imported: number;
  already_member: number;
  invitation_sent: number;
  user_not_found?: number;
  invalid: number;
  duplicate: number;
  results: Array<{ identifier: string; status: string; message: string }>;
};

const IMPORT_STATUSES = ["imported", "reactivated", "already_member", "user_not_found", "invalid", "invitation_sent", "duplicate"] as const;

export const parsePhoneList = (raw: string) =>
  raw
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);

const canManageMembers = (role?: OrganizationMemberRole) => role === "OWNER" || role === "ADMIN";

const publicIdForRole = (member: OrganizationMemberItem, addRole: AddableRole) => {
  if (addRole === "STUDENT") {
    return member.user.student_public_id || member.user.teacher_public_id || member.user.public_id || "—";
  }
  return member.user.teacher_public_id || member.user.student_public_id || member.user.public_id || "—";
};

const matches = (member: OrganizationMemberItem, query: string) =>
  [member.user.full_name, member.user.email, member.user.phone, member.user.teacher_public_id, member.user.student_public_id].some((value) =>
    (value || "").toLowerCase().includes(query),
  );

/** One kind of organisation member (teachers, assistants or students): the list, and adding or removing people. */
const OrganizationMembersTable = ({
  titleKey,
  roles,
  addRole,
}: {
  titleKey: "teachers" | "assistants" | "students";
  roles: OrganizationMemberRole[];
  addRole: AddableRole;
}) => {
  const t = useTranslations("organization.members");
  const tOrg = useTranslations("organization");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<OrganizationMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<LookupPayload | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<OrganizationMemberItem | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResultPayload | null>(null);
  const [phoneList, setPhoneList] = useState("");
  const [addingPhones, setAddingPhones] = useState(false);

  const canManage = canManageMembers(activeOrganization?.role);

  const load = useCallback(async () => {
    if (!organizationId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<OrganizationMemberItem[]>>(`${baseUrl}/organizations/${organizationId}/members`);
      setMembers(res.data?.payload ?? []);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((member) => roles.includes(member.role)).filter((member) => !q || matches(member, q));
  }, [members, roles, search]);

  const openDrawer = () => {
    setQuery("");
    setLookup(null);
    setImportSummary(null);
    setPhoneList("");
    setLookingUp(false);
    setSubmitting(false);
    setDrawerOpen(true);
  };

  const handleLookup = async () => {
    if (!organizationId) return;
    const trimmed = query.trim();
    if (!trimmed) {
      triggerToast({ title: t("missingQuery"), description: t(`lookupLabel.${addRole}`), type: "error" });
      return;
    }
    setLookingUp(true);
    setLookup(null);
    try {
      const res = await axiosReq.get<ApiResponse<LookupPayload>>(`${baseUrl}/organizations/${organizationId}/members/lookup`, {
        params: { q: trimmed },
      });
      setLookup(res.data?.payload ?? null);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLookingUp(false);
    }
  };

  const handleAddOrInvite = async () => {
    if (!organizationId) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await axiosReq.post<ApiResponse<AddMemberPayload>>(`${baseUrl}/organizations/${organizationId}/members`, {
        query: trimmed,
        role: addRole,
      });
      if (res.data?.payload?.status === "invited") {
        triggerToast({ title: t("invitedTitle"), description: t("invitedDetail"), type: "success" });
      } else {
        triggerToast({ title: t("addedTitle"), description: t("addedDetail"), type: "success" });
      }
      setDrawerOpen(false);
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!organizationId || !removing) return;
    setRemovingBusy(true);
    try {
      await axiosReq.delete(`${baseUrl}/organizations/${organizationId}/members/${removing.id}`);
      triggerToast({ title: t("removedTitle"), description: t("removedDetail"), type: "success" });
      setRemoving(null);
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setRemovingBusy(false);
    }
  };

  const runImport = async (identifiers: string[], extra: Record<string, unknown>, done: { title: string; description: string }) => {
    if (!organizationId) return;
    setImportSummary(null);
    const res = await axiosReq.post<ApiResponse<ImportResultPayload>>(`${baseUrl}/organizations/${organizationId}/members/import`, {
      identifiers,
      role: addRole,
      ...extra,
    });
    setImportSummary(res.data?.payload ?? null);
    triggerToast({ ...done, type: "success" });
    await load();
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const identifiers = extractStudentsFromCsvRows(parseCsvText(await file.text()));
      if (identifiers.length === 0) {
        triggerToast({ title: t("emptyFileTitle"), description: t("emptyFile"), type: "error" });
        return;
      }
      await runImport(identifiers, {}, { title: t("importDoneTitle"), description: t("importDone") });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setImporting(false);
    }
  };

  const handlePhoneListAdd = async () => {
    const identifiers = parsePhoneList(phoneList);
    if (identifiers.length === 0) {
      triggerToast({ title: t("noPhonesTitle"), description: t("noPhones"), type: "error" });
      return;
    }
    setAddingPhones(true);
    try {
      await runImport(identifiers, { invite_missing: false }, { title: t("phonesDoneTitle"), description: t("phonesDone") });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setAddingPhones(false);
    }
  };

  const importStatusLabel = (status: string) =>
    (IMPORT_STATUSES as readonly string[]).includes(status) ? t(`importStatus.${status as (typeof IMPORT_STATUSES)[number]}`) : status;
  const alreadyActiveMember = Boolean(lookup?.found && lookup.membership && Number(lookup.membership.is_active) === 1);

  const columns: TableColumn<OrganizationMemberItem>[] = [
    { key: "name", header: t("name"), cell: (row) => row.user.full_name || "—", sortValue: (row) => row.user.full_name },
    { key: "id", header: t(`idColumn.${addRole}`), cell: (row) => publicIdForRole(row, addRole), hideOnMobile: true },
    { key: "email", header: t("email"), cell: (row) => row.user.email || "—", hideOnMobile: true },
    { key: "phone", header: t("phone"), cell: (row) => row.user.phone || "—" },
    { key: "role", header: t("role"), cell: (row) => <Badge>{tOrg(`roles.${row.role}`)}</Badge>, sortValue: (row) => row.role },
    {
      key: "joined",
      header: t("joined"),
      cell: (row) => (row.created_at ? format.date(row.created_at) : "—"),
      sortValue: (row) => (row.created_at ? new Date(row.created_at) : null),
      hideOnMobile: true,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: t("actions"),
            align: "right" as const,
            cell: (row: OrganizationMemberItem) =>
              row.role === "OWNER" ? (
                <span className="text-ink-muted">—</span>
              ) : (
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(row)}>
                  {t("remove")}
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t(titleKey)}
        description={activeOrganization?.name}
        actions={canManage ? <Button onClick={openDrawer}>{t(`add.${addRole}`)}</Button> : undefined}
      />
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t("search")} />
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : (
          <Table caption={t(titleKey)} columns={columns} rows={filtered} getRowId={(row) => row.id} empty={<EmptyState title={t("empty")} />} />
        )}
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t(`add.${addRole}`)} description={t("addIntro")}>
        <div className="flex flex-col gap-6">
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLookup();
            }}
          >
            <div className="flex items-end gap-2">
              <Input
                fieldClassName="flex-1"
                label={t(`lookupLabel.${addRole}`)}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLookup(null);
                }}
              />
              <Button type="submit" variant="secondary" loading={lookingUp}>
                {t("find")}
              </Button>
            </div>

            {lookup && !lookup.found ? (
              <div className="flex flex-col items-start gap-2 rounded-input bg-canvas p-4 text-body-sm">
                <p className="font-medium text-ink">{t("notFoundTitle")}</p>
                <p className="text-ink-muted">{lookup.message}</p>
                <Button size="sm" loading={submitting} onClick={() => void handleAddOrInvite()}>
                  {t("sendInvite")}
                </Button>
              </div>
            ) : null}

            {lookup?.found ? (
              <div className="flex flex-col items-start gap-2 rounded-input border border-border p-4 text-body-sm">
                <p className="text-body font-medium text-ink">{lookup.user.full_name || t("unnamed")}</p>
                <div className="flex flex-col gap-0.5 text-ink-muted">
                  <p>
                    {t("teacherId", { id: lookup.user.teacher_public_id || "—" })}
                    {lookup.user.student_public_id ? ` · ${t("studentId", { id: lookup.user.student_public_id })}` : ""}
                  </p>
                  <p>
                    {t("email")}: {lookup.user.email || "—"}
                  </p>
                  <p>
                    {t("phone")}: {lookup.user.phone || "—"}
                  </p>
                </div>
                {alreadyActiveMember ? (
                  <p className="text-danger">{t("alreadyMember")}</p>
                ) : (
                  <Button size="sm" loading={submitting} disabled={!lookup.user.is_otp_verified} onClick={() => void handleAddOrInvite()}>
                    {lookup.membership ? t("restore") : t("addToOrg")}
                  </Button>
                )}
                {!lookup.user.is_otp_verified ? <p className="text-danger">{t("notVerified")}</p> : null}
              </div>
            ) : null}
          </form>

          <section className="flex flex-col gap-3 border-t border-border pt-5">
            <h3 className="text-body font-semibold text-ink">{t("phoneListTitle")}</h3>
            <Textarea
              label={t("phoneListLabel")}
              hint={t(`phoneListHint.${addRole}`)}
              rows={5}
              value={phoneList}
              onChange={(event) => setPhoneList(event.target.value)}
              placeholder={"017XXXXXXXX\n018XXXXXXXX"}
              className="font-mono"
            />
            <Button variant="secondary" className="self-start" loading={addingPhones} onClick={() => void handlePhoneListAdd()}>
              {t("addPhones")}
            </Button>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-5">
            <h3 className="text-body font-semibold text-ink">{t("csvTitle")}</h3>
            <p className="text-body-sm text-ink-muted">{t("csvHint")}</p>
            <div className="flex flex-wrap gap-2">
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void handleCsvUpload(event)} />
              <Button variant="secondary" size="sm" loading={importing} onClick={() => fileInputRef.current?.click()}>
                {t("uploadCsv")}
              </Button>
              <Button variant="ghost" size="sm" className="text-primary" onClick={downloadStudentCsvTemplate}>
                {t("downloadTemplate")}
              </Button>
            </div>
          </section>

          {importSummary ? (
            <section className="flex flex-col gap-2 text-body-sm" aria-live="polite">
              <p className="font-medium text-ink">
                {t("summary", {
                  imported: importSummary.imported,
                  already: importSummary.already_member,
                  notFound: importSummary.user_not_found ?? 0,
                  invalid: importSummary.invalid,
                  invited: importSummary.invitation_sent,
                  duplicate: importSummary.duplicate,
                })}
              </p>
              <Table
                caption={t("importDoneTitle")}
                columns={[
                  { key: "value", header: t("resultValue"), cell: (row) => row.identifier || "—" },
                  { key: "status", header: t("resultStatus"), cell: (row) => importStatusLabel(row.status) },
                  { key: "message", header: t("resultMessage"), cell: (row) => <span className="text-ink-muted">{row.message}</span> },
                ]}
                rows={importSummary.results.map((row, index) => ({ ...row, index }))}
                getRowId={(row) => String(row.index)}
              />
            </section>
          ) : null}
        </div>
      </Drawer>

      <ConfirmDialog
        open={Boolean(removing)}
        tone="danger"
        title={t("removeTitle", { name: removing?.user.full_name || removing?.user.phone || "" })}
        description={t("removeDetail")}
        confirmLabel={t("remove")}
        loading={removingBusy}
        onCancel={() => setRemoving(null)}
        onConfirm={() => void handleRemove()}
      />
    </div>
  );
};

export const OrganizationTeachers = () => (
  <OrganizationWorkspaceGate allowedRoles={["OWNER", "ADMIN"]}>
    <OrganizationMembersTable titleKey="teachers" roles={["OWNER", "ADMIN", "TEACHER"]} addRole="TEACHER" />
  </OrganizationWorkspaceGate>
);

export const OrganizationAssistants = () => (
  <OrganizationWorkspaceGate allowedRoles={["OWNER", "ADMIN"]}>
    <OrganizationMembersTable titleKey="assistants" roles={["ASSISTANT"]} addRole="ASSISTANT" />
  </OrganizationWorkspaceGate>
);

export const OrganizationStudents = () => (
  <OrganizationWorkspaceGate allowedRoles={["OWNER", "ADMIN"]}>
    <OrganizationMembersTable titleKey="students" roles={["STUDENT"]} addRole="STUDENT" />
  </OrganizationWorkspaceGate>
);

export default OrganizationMembersTable;
