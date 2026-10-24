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
      (subject) => subject.name.toLowerCase().includes(q) || (subject.code ?? "").toLowerCase().includes(q),
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
        <div className="text-title-sm md:text-display tracking-tight flex items-center gap-0 flex-wrap mr-4">
          <p className="font-medium text-ink">Subject</p>
          <p className="font-normal text-primary italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            Details
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center justify-center gap-2 h-[40px] px-4 bg-ink rounded-xl font-medium text-ink-inverse text-body-sm"
        >
          + Add subject
        </button>
      </div>

      <div className="bg-canvas rounded-card p-2 sm:p-4 min-h-[calc(100vh-162px)] flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject by name or code..."
            className="border border-border bg-surface rounded-input px-3 py-2 text-sm max-w-sm w-full focus:outline-none focus:border-primary"
          />
          <p className="text-sm text-ink-muted">
            Total: <strong className="text-primary">{filtered.length}</strong>
          </p>
        </div>

        <div className="bg-surface rounded-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-ink">
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
                  <td colSpan={4} className="p-6 text-center text-ink-muted">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-ink-muted">
                    No subjects yet
                  </td>
                </tr>
              ) : (
                filtered.map((subject) => (
                  <tr key={subject.id} className="border-t border-border">
                    <td className="p-3 font-medium text-ink">{subject.name}</td>
                    <td className="p-3 text-primary">{subject.code ?? "—"}</td>
                    <td className="p-3 text-ink-muted">{subject.created_user_name ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <button
                          type="button"
                          onClick={() => openEdit(subject)}
                          className="px-3 py-1.5 text-xs border border-primary text-primary rounded-input"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void hardDelete(subject)}
                          className="px-3 py-1.5 text-xs bg-danger text-ink-inverse rounded-input"
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
          <div className="bg-surface rounded-card w-full max-w-md max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">{isNew ? "Add subject" : "Edit subject"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-ink-muted text-xl leading-none">
                ×
              </button>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">Name</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Mathematics"
                className="border border-border rounded-input px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">Code (optional)</span>
              <input
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                placeholder="e.g. MATH"
                className="border border-border rounded-input px-3 py-2"
              />
            </label>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 h-[40px] rounded-input border border-border text-ink text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-4 h-[40px] rounded-input bg-primary text-ink-inverse text-sm disabled:opacity-60"
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
