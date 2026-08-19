"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import { useToast } from "@/component/Toast/ToastContext";
import useWorkspace from "@/hooks/organization/useWorkspace";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";
import ButtonLoader from "@/component/Loader/ButtonLoadder";
import CrossIconSVG from "@/component/svg/CrossIconSVG";
import {
  downloadStudentCsvTemplate,
  extractStudentsFromCsvRows,
  parseCsvText,
} from "@/utils/classes/addStudentModal";

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

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
  | {
      status: "added";
      member: OrganizationMemberItem;
    }
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
  invalid: number;
  duplicate: number;
  results: Array<{
    identifier: string;
    status: string;
    message: string;
  }>;
};

const canManageMembers = (role?: OrganizationMemberRole) =>
  role === "OWNER" || role === "ADMIN";

const publicIdForRole = (member: OrganizationMemberItem, addRole: OrganizationMemberRole) => {
  if (addRole === "STUDENT") {
    return member.user.student_public_id || member.user.teacher_public_id || member.user.public_id || "—";
  }
  return member.user.teacher_public_id || member.user.student_public_id || member.user.public_id || "—";
};

const OrganizationMembersTable = ({
  title,
  roles,
  allowManage = false,
  addRole = "TEACHER",
  addLabel = "Add Teacher",
  searchPlaceholder = "Search by Teacher ID, phone or email",
  idColumnLabel = "Teacher ID",
}: {
  title: string;
  roles: OrganizationMemberRole[];
  allowManage?: boolean;
  addRole?: OrganizationMemberRole;
  addLabel?: string;
  searchPlaceholder?: string;
  idColumnLabel?: string;
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<OrganizationMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<LookupPayload | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResultPayload | null>(null);

  const canManage = allowManage && canManageMembers(activeOrganization?.role);

  const load = useCallback(async () => {
    if (!organizationId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<OrganizationMemberItem[]>>(
        `${baseUrl}/organizations/${organizationId}/members`,
      );
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
    return members
      .filter((member) => roles.includes(member.role))
      .filter((member) => {
        if (!q) return true;
        return (
          (member.user.full_name || "").toLowerCase().includes(q) ||
          (member.user.email || "").toLowerCase().includes(q) ||
          (member.user.phone || "").toLowerCase().includes(q) ||
          (member.user.teacher_public_id || "").toLowerCase().includes(q) ||
          (member.user.student_public_id || "").toLowerCase().includes(q)
        );
      });
  }, [members, roles, search]);

  const resetModal = () => {
    setQuery("");
    setLookup(null);
    setImportSummary(null);
    setLookingUp(false);
    setSubmitting(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetModal();
  };

  const handleLookup = async () => {
    if (!organizationId) return;
    const trimmed = query.trim();
    if (!trimmed) {
      triggerToast({
        title: "Missing search value",
        description: searchPlaceholder,
        type: "error",
      });
      return;
    }

    setLookingUp(true);
    setLookup(null);
    try {
      const res = await axiosReq.get<ApiResponse<LookupPayload>>(
        `${baseUrl}/organizations/${organizationId}/members/lookup`,
        { params: { q: trimmed } },
      );
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
      const res = await axiosReq.post<ApiResponse<AddMemberPayload>>(
        `${baseUrl}/organizations/${organizationId}/members`,
        { query: trimmed, role: addRole },
      );
      const payload = res.data?.payload;
      if (payload?.status === "invited") {
        triggerToast({
          title: "Invitation sent",
          description: "They will join this organization after registering or signing in.",
          type: "success",
        });
      } else {
        triggerToast({
          title: `${addLabel} done`,
          description: "Membership was created or restored. No duplicate account was created.",
          type: "success",
        });
      }
      closeModal();
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!organizationId) return;
    if (!window.confirm("Remove this member from the organization? History will be kept.")) {
      return;
    }

    setRemovingId(memberId);
    try {
      await axiosReq.delete(`${baseUrl}/organizations/${organizationId}/members/${memberId}`);
      triggerToast({
        title: "Member removed",
        description: "Access was revoked. Historical records were preserved.",
        type: "success",
      });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setRemovingId(null);
    }
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!organizationId) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportSummary(null);
    try {
      const text = await file.text();
      const identifiers = extractStudentsFromCsvRows(parseCsvText(text));
      if (identifiers.length === 0) {
        triggerToast({
          title: "Empty file",
          description: "No phone, email, or ID values were found in the CSV.",
          type: "error",
        });
        return;
      }

      const res = await axiosReq.post<ApiResponse<ImportResultPayload>>(
        `${baseUrl}/organizations/${organizationId}/members/import`,
        { identifiers, role: addRole },
      );
      setImportSummary(res.data?.payload ?? null);
      triggerToast({
        title: "Import finished",
        description: "Review row-level results below.",
        type: "success",
      });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setImporting(false);
    }
  };

  const alreadyActiveMember =
    lookup?.found &&
    lookup.membership &&
    Number(lookup.membership.is_active) === 1;

  return (
    <div>
      <div className="mb-4 flex justify-between items-center w-full min-h-[40px] gap-3 flex-wrap">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">{title}</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            {activeOrganization?.name || ""}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              resetModal();
              setModalOpen(true);
            }}
            className="bg-[#49734F] text-white rounded-[8px] px-4 py-2 text-sm font-medium"
          >
            + {addLabel}
          </button>
        )}
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)] flex flex-col gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, email, or phone..."
          className="border border-[#EFF0F3] bg-white rounded-[8px] px-3 py-2 text-sm max-w-sm focus:outline-none focus:border-[#49734F]"
        />

        <div className="bg-white rounded-[12px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EFF0F3] text-left text-[#232A25]">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">{idColumnLabel}</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Role</th>
                <th className="p-3">Joined</th>
                {canManage && <th className="p-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="p-6 text-center text-[#747775]">
                    Loading members...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="p-6 text-center text-[#747775]">
                    No members found.
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.id} className="border-t border-[#F0F0F0]">
                    <td className="p-3 text-[#232A25]">{member.user.full_name || "—"}</td>
                    <td className="p-3 text-[#232A25]">{publicIdForRole(member, addRole)}</td>
                    <td className="p-3 text-[#232A25]">{member.user.email || "—"}</td>
                    <td className="p-3 text-[#232A25]">{member.user.phone || "—"}</td>
                    <td className="p-3 text-[#232A25]">{member.role}</td>
                    <td className="p-3 text-[#232A25]">{formatDate(member.created_at)}</td>
                    {canManage && (
                      <td className="p-3">
                        {member.role === "OWNER" ? (
                          <span className="text-[#747775]">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleRemove(member.id)}
                            disabled={removingId === member.id}
                            className="text-[#B42318] text-sm font-medium disabled:opacity-50"
                          >
                            {removingId === member.id ? "Removing..." : "Remove"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="absolute top-2 right-2 h-[calc(100vh-8px)] w-[calc(100vw-8px)] sm:w-[560px] z-50 bg-white rounded-xl p-4 sm:p-8 shadow-lg overflow-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="pb-4 flex justify-between items-center">
              <p className="font-[600] text-[24px] leading-[24px] tracking-[-0.04em] text-[#232A25]">
                {addLabel}
              </p>
              <button type="button" className="text-[#747775]" onClick={closeModal}>
                <CrossIconSVG width={24} />
              </button>
            </div>

            <p className="text-[14px] text-[#747775] mb-4">
              Search by one field. Existing users are added to this organization. Unknown contacts
              receive an SMS or email invitation. No duplicate accounts are created.
            </p>

            <label className="block text-[14px] font-medium text-[#232A25] mb-2">
              {searchPlaceholder}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLookup(null);
                }}
                placeholder={searchPlaceholder}
                className="border border-[#EFF0F3] bg-white rounded-[8px] px-3 py-2 text-sm flex-1 focus:outline-none focus:border-[#49734F]"
              />
              <button
                type="button"
                onClick={() => void handleLookup()}
                disabled={lookingUp}
                className="border border-[#C6CFCF] rounded-[8px] px-4 py-2 text-sm font-medium text-[#232A25] disabled:opacity-60 flex items-center justify-center"
              >
                <ButtonLoader show={lookingUp} w="w-4" h="h-4" mr="mr-2" />
                {lookingUp ? "Searching..." : "Search"}
              </button>
            </div>

            {lookup && !lookup.found && (
              <div className="mt-4 rounded-[8px] bg-[#EFF0F3] p-4 text-sm text-[#232A25]">
                <p className="font-medium">No existing user found</p>
                <p className="text-[#747775] mt-1">{lookup.message}</p>
                <button
                  type="button"
                  onClick={() => void handleAddOrInvite()}
                  disabled={submitting}
                  className="mt-3 bg-[#49734F] text-white rounded-[8px] px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center"
                >
                  <ButtonLoader show={submitting} w="w-4" h="h-4" mr="mr-2" />
                  {submitting ? "Sending..." : "Send invitation"}
                </button>
              </div>
            )}

            {lookup?.found && (
              <div className="mt-4 rounded-[8px] border border-[#EFF0F3] p-4 text-sm text-[#232A25]">
                <p className="font-medium text-[16px]">{lookup.user.full_name || "Unnamed user"}</p>
                <div className="mt-2 grid gap-1 text-[#747775]">
                  <p>
                    Teacher ID: {lookup.user.teacher_public_id || "—"}
                    {lookup.user.student_public_id ? ` · Student ID: ${lookup.user.student_public_id}` : ""}
                  </p>
                  <p>Email: {lookup.user.email || "—"}</p>
                  <p>Phone: {lookup.user.phone || "—"}</p>
                </div>
                {alreadyActiveMember ? (
                  <p className="mt-3 text-[#B42318]">This person is already an active member.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleAddOrInvite()}
                    disabled={submitting || !lookup.user.is_otp_verified}
                    className="mt-3 bg-[#49734F] text-white rounded-[8px] px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center"
                  >
                    <ButtonLoader show={submitting} w="w-4" h="h-4" mr="mr-2" />
                    {submitting
                      ? "Adding..."
                      : lookup.membership
                        ? "Restore membership"
                        : "Add to Organization"}
                  </button>
                )}
                {!lookup.user.is_otp_verified && (
                  <p className="mt-2 text-[#B42318]">This account is not verified yet.</p>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-[#EFF0F3] pt-4">
              <p className="text-[14px] font-medium text-[#232A25] mb-2">Import from CSV</p>
              <p className="text-[13px] text-[#747775] mb-3">
                One column of Teacher/Student ID, phone, or email. Row-level results are shown after import.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => void handleCsvUpload(e)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="h-[32px] rounded-lg border border-[#C6CFCF] px-3 text-sm font-medium text-[#232A25] disabled:opacity-60"
                >
                  {importing ? "Importing..." : "Upload CSV"}
                </button>
                <button
                  type="button"
                  onClick={downloadStudentCsvTemplate}
                  className="h-[32px] rounded-lg border border-[#C6CFCF] px-3 text-sm font-medium text-[#49734F]"
                >
                  Download demo CSV
                </button>
              </div>

              {importSummary && (
                <div className="mt-4 text-sm">
                  <p className="text-[#232A25] font-medium mb-2">
                    Imported {importSummary.imported} · Already member {importSummary.already_member} ·
                    Invited {importSummary.invitation_sent} · Invalid {importSummary.invalid} ·
                    Duplicate {importSummary.duplicate}
                  </p>
                  <div className="max-h-48 overflow-auto rounded-[8px] border border-[#EFF0F3]">
                    <table className="w-full">
                      <thead className="bg-[#EFF0F3] text-left">
                        <tr>
                          <th className="p-2">Value</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importSummary.results.map((row, index) => (
                          <tr key={`${row.identifier}-${index}`} className="border-t border-[#F0F0F0]">
                            <td className="p-2">{row.identifier || "—"}</td>
                            <td className="p-2">{row.status}</td>
                            <td className="p-2 text-[#747775]">{row.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const OrganizationTeachers = () => (
  <OrganizationWorkspaceGate title="Organization Teachers" allowedRoles={["OWNER", "ADMIN"]}>
    <OrganizationMembersTable
      title="Teachers"
      roles={["OWNER", "ADMIN", "TEACHER"]}
      allowManage
      addRole="TEACHER"
      addLabel="Add Teacher"
      searchPlaceholder="Search by Teacher ID, phone or email"
      idColumnLabel="Teacher ID"
    />
  </OrganizationWorkspaceGate>
);

export const OrganizationAssistants = () => (
  <OrganizationWorkspaceGate title="Organization Assistants" allowedRoles={["OWNER", "ADMIN"]}>
    <OrganizationMembersTable
      title="Assistants"
      roles={["ASSISTANT"]}
      allowManage
      addRole="ASSISTANT"
      addLabel="Add Assistant"
      searchPlaceholder="Search by Teacher ID, phone or email"
      idColumnLabel="Teacher ID"
    />
  </OrganizationWorkspaceGate>
);

export const OrganizationStudents = () => (
  <OrganizationWorkspaceGate title="Organization Students" allowedRoles={["OWNER", "ADMIN"]}>
    <OrganizationMembersTable
      title="Students"
      roles={["STUDENT"]}
      allowManage
      addRole="STUDENT"
      addLabel="Add Student"
      searchPlaceholder="Search by Student ID, phone or email"
      idColumnLabel="Student ID"
    />
  </OrganizationWorkspaceGate>
);

export default OrganizationMembersTable;
