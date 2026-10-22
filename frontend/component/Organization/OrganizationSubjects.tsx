"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import { useToast } from "@/component/Toast/ToastContext";
import useWorkspace from "@/hooks/organization/useWorkspace";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";
import NormalInput from "@/Ui/NormalInput";
import CreateModal from "@/component/Tests/Create/CreateModal";

const OrganizationSubjectsContent = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [subjects, setSubjects] = useState<OrganizationSubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<OrganizationSubjectItem[]>>(
        `${baseUrl}/organizations/${organizationId}/subjects`,
      );
      setSubjects(res.data?.payload ?? []);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeCreateModal = () => {
    setCreateOpen(false);
    setName("");
    setCode("");
  };

  const handleCreate = async () => {
    if (!organizationId || !name.trim() || !code.trim()) {
      triggerToast({
        title: "Name and code required",
        description: "Enter a subject name and code, for example Physics and PHY-09.",
        type: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await axiosReq.post(`${baseUrl}/organizations/${organizationId}/subjects`, {
        name: name.trim(),
        code: code.trim(),
      });
      closeCreateModal();
      triggerToast({
        title: "Subject created",
        description: "The subject is available for class assignment.",
        type: "success",
      });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (subjectId: string) => {
    if (!organizationId || !editName.trim() || !editCode.trim()) {
      triggerToast({
        title: "Name and code required",
        description: "Both fields are required to save a subject.",
        type: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await axiosReq.patch(`${baseUrl}/organizations/${organizationId}/subjects/${subjectId}`, {
        name: editName.trim(),
        code: editCode.trim(),
      });
      setEditingId(null);
      triggerToast({ title: "Subject updated", description: "Subject name and code were saved.", type: "success" });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subjectId: string) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      await axiosReq.delete(`${baseUrl}/organizations/${organizationId}/subjects/${subjectId}`);
      triggerToast({ title: "Subject deleted", description: "The subject was removed from the catalog.", type: "success" });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-between items-center w-full min-h-[40px] gap-3 flex-wrap">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Organization Subjects</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            {activeOrganization?.name || ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-[#49734F] text-white rounded-[8px] px-4 py-2 text-sm font-medium"
        >
          Create Subject
        </button>
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)] flex flex-col gap-4">
        <div className="bg-white rounded-[12px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EFF0F3] text-left text-[#232A25]">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Code</th>
                <th className="p-3">Classes</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#747775]">
                    Loading subjects...
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#747775]">
                    No subjects yet. Click Create Subject to add Physics / PHY-09.
                  </td>
                </tr>
              ) : (
                subjects.map((subject) => (
                  <tr key={subject.id} className="border-t border-[#F0F0F0]">
                    <td className="p-3 text-[#232A25]">
                      {editingId === subject.id ? (
                        <NormalInput
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          parentClassName="h-[36px] w-full rounded-[8px] border-[#E5E5E5]"
                          inputClassName="px-2 text-sm"
                          placeholder="Name"
                          afterIcon={null}
                        />
                      ) : (
                        subject.name
                      )}
                    </td>
                    <td className="p-3 text-[#232A25]">
                      {editingId === subject.id ? (
                        <NormalInput
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          parentClassName="h-[36px] w-full rounded-[8px] border-[#E5E5E5]"
                          inputClassName="px-2 text-sm"
                          placeholder="Code"
                          afterIcon={null}
                        />
                      ) : (
                        subject.code || "—"
                      )}
                    </td>
                    <td className="p-3 text-[#232A25]">
                      {(subject.classes ?? []).map((item) => item.class_name).join(", ") || "—"}
                    </td>
                    <td className="p-3">
                      {editingId === subject.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleUpdate(subject.id)}
                            className="text-[#49734F] font-medium"
                          >
                            Save
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="text-[#747775]">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(subject.id);
                              setEditName(subject.name);
                              setEditCode(subject.code || "");
                            }}
                            className="text-[#49734F] font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleDelete(subject.id)}
                            className="text-[#C1121F] font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal open={createOpen} onClose={closeCreateModal} maxWidthClassName="max-w-[520px]" panelClassName="p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-[20px] font-[600] leading-[24px] tracking-[-0.03em] text-[#232A25]">Create Subject</p>
          <p className="text-[14px] font-[400] leading-[20px] tracking-[-0.02em] text-[#747775]">
            Add a subject name and code for this organization. Codes must be unique within the organization.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-[500] leading-[18px] tracking-[-0.02em] text-[#0F1A12]">
              Subject name
            </label>
            <NormalInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Physics"
              parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
              inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775]"
              afterIcon={null}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-[500] leading-[18px] tracking-[-0.02em] text-[#0F1A12]">
              Subject code
            </label>
            <NormalInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., PHY-09"
              parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
              inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775]"
              afterIcon={null}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={closeCreateModal}
            className="h-10 rounded-[8px] px-4 text-sm font-medium text-[#232A25] border border-[#E5E5E5]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreate()}
            className={`h-10 rounded-[8px] px-4 text-sm font-medium text-white ${saving ? "bg-[#747775]" : "bg-[#49734F]"}`}
          >
            Create Subject
          </button>
        </div>
      </CreateModal>
    </div>
  );
};

const OrganizationSubjects = () => (
  <OrganizationWorkspaceGate title="Organization Subjects" allowedRoles={["OWNER", "ADMIN", "ASSISTANT"]}>
    <OrganizationSubjectsContent />
  </OrganizationWorkspaceGate>
);

export default OrganizationSubjects;
