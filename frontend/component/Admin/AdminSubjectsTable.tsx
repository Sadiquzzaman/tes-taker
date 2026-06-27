"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  created_user_name?: string | null;
};

type SubjectDraft = {
  id?: string;
  name: string;
  code: string;
};

const emptyDraft = (): SubjectDraft => ({ name: "", code: "" });

const AdminSubjectsTable = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SubjectDraft | null>(null);
  const [isNew, setIsNew] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get(`${baseUrl}/subjects`);
      setSubjects(res.data?.payload ?? []);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (subject) =>
        subject.name.toLowerCase().includes(q) || (subject.code ?? "").toLowerCase().includes(q),
    );
  }, [subjects, search]);

  const openCreate = () => {
    setIsNew(true);
    setEditing(emptyDraft());
  };

  const openEdit = (subject: SubjectRow) => {
    setIsNew(false);
    setEditing({ id: subject.id, name: subject.name, code: subject.code ?? "" });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      triggerToast({ title: "Missing fields", description: "Name is required.", type: "error" });
      return;
    }
    setSaving(true);
    const body = { name: editing.name.trim(), code: editing.code.trim() || null };
    try {
      if (isNew) {
        await axiosReq.post(`${baseUrl}/subjects`, body);
        triggerToast({ title: "Created", description: "Subject created successfully.", type: "success" });
      } else {
        await axiosReq.patch(`${baseUrl}/subjects/${editing.id}`, body);
        triggerToast({ title: "Saved", description: "Subject updated successfully.", type: "success" });
      }
      setEditing(null);
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const hardDelete = async (subject: SubjectRow) => {
    const ok = window.confirm(`Permanently delete "${subject.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await axiosReq.delete(`${baseUrl}/subjects/${subject.id}`);
      triggerToast({ title: "Deleted", description: "Subject permanently deleted.", type: "success" });
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Subject</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            Details
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center justify-center gap-2 h-[40px] px-4 bg-[#232A25] rounded-xl font-[500] text-white text-[14px]"
        >
          + Add subject
        </button>
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)] flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject by name or code..."
            className="border border-[#EFF0F3] bg-white rounded-[8px] px-3 py-2 text-sm max-w-sm w-full focus:outline-none focus:border-[#49734F]"
          />
          <p className="text-sm text-[#747775]">
            Total: <strong className="text-[#49734F]">{filtered.length}</strong>
          </p>
        </div>

        <div className="bg-white rounded-[12px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EFF0F3] text-left text-[#232A25]">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Code</th>
                <th className="p-3">Created by</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#747775]">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#747775]">
                    No subjects yet
                  </td>
                </tr>
              ) : (
                filtered.map((subject) => (
                  <tr key={subject.id} className="border-t border-[#EFF0F3]">
                    <td className="p-3 font-medium text-[#232A25]">{subject.name}</td>
                    <td className="p-3 text-[#49734F]">{subject.code ?? "—"}</td>
                    <td className="p-3 text-[#747775]">{subject.created_user_name ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <button
                          type="button"
                          onClick={() => openEdit(subject)}
                          className="px-3 py-1.5 text-xs border border-[#49734F] text-[#49734F] rounded-[6px]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void hardDelete(subject)}
                          className="px-3 py-1.5 text-xs bg-[#C0392B] text-white rounded-[6px]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[12px] w-full max-w-md max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#232A25]">{isNew ? "Add subject" : "Edit subject"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-[#747775] text-xl leading-none">
                ×
              </button>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[#747775]">Name</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Mathematics"
                className="border border-[#EFF0F3] rounded-[6px] px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[#747775]">Code (optional)</span>
              <input
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                placeholder="e.g. MATH"
                className="border border-[#EFF0F3] rounded-[6px] px-3 py-2"
              />
            </label>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 h-[40px] rounded-[8px] border border-[#EFF0F3] text-[#232A25] text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-4 h-[40px] rounded-[8px] bg-[#49734F] text-white text-sm disabled:opacity-60"
              >
                {saving ? "Saving..." : isNew ? "Create subject" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminSubjectsTable;
