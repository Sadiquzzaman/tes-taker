"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import { useToast } from "@/component/Toast/ToastContext";
import useWorkspace from "@/hooks/organization/useWorkspace";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";
import DropDownComponent from "@/Ui/DropDownComponent";

const subjectLabel = (row: ClassSubject) =>
  row.subject?.code ? `${row.subject.name} — ${row.subject.code}` : row.subject?.name || "Organization Subject";

const catalogSubjectLabel = (subject: OrganizationSubjectItem) =>
  subject.code ? `${subject.name} — ${subject.code}` : subject.name;

const teacherLabel = (member: OrganizationMemberItem) =>
  member.user.full_name || member.user.phone || "Teacher";

const assignmentTeacherName = (assignment: ClassSubjectTeacherAssignment) =>
  assignment.teacher?.full_name?.trim() || "Teacher";

const OrganizationAssignmentsContent = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const step2Ref = useRef<HTMLDivElement>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [catalog, setCatalog] = useState<OrganizationSubjectItem[]>([]);
  const [teachers, setTeachers] = useState<OrganizationMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedCatalogSubjectId, setSelectedCatalogSubjectId] = useState("");
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [tableClassFilter, setTableClassFilter] = useState("all");
  const [tableSubjectFilter, setTableSubjectFilter] = useState("all");
  const [tableTeacherFilter, setTableTeacherFilter] = useState("all");

  const resetFormState = useCallback(() => {
    setSelectedClassId("");
    setSelectedCatalogSubjectId("");
    setSelectedClassSubjectId("");
    setSelectedTeacherId("");
    setEditingAssignmentId("");
    setTableClassFilter("all");
    setTableSubjectFilter("all");
    setTableTeacherFilter("all");
  }, []);

  const load = useCallback(async () => {
    if (!organizationId) {
      setClasses([]);
      setCatalog([]);
      setTeachers([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const [classRes, catalogRes, teacherRes] = await Promise.all([
        axiosReq.get<ApiResponse<Class[]>>(`${baseUrl}/classes`),
        axiosReq.get<ApiResponse<OrganizationSubjectItem[]>>(
          `${baseUrl}/organizations/${organizationId}/subjects`,
        ),
        axiosReq.get<ApiResponse<OrganizationMemberItem[]>>(
          `${baseUrl}/organizations/${organizationId}/assignable-teachers`,
        ),
      ]);
      const nextClasses = classRes.data?.payload ?? [];
      setClasses(nextClasses);
      setCatalog(catalogRes.data?.payload ?? []);
      setTeachers(teacherRes.data?.payload ?? []);
      return nextClasses;
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setClasses([]);
      setCatalog([]);
      setTeachers([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    resetFormState();
  }, [organizationId, resetFormState]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const classSubjects = useMemo(() => selectedClass?.classSubjects ?? [], [selectedClass]);
  const classOptions = useMemo(
    () => classes.map((item) => ({ label: item.class_name, value: item.id })),
    [classes],
  );
  const attachedSubjectOptions = useMemo(
    () => classSubjects.map((row) => ({ label: subjectLabel(row), value: row.id })),
    [classSubjects],
  );
  const attachableSubjectOptions = useMemo(() => {
    const attachedIds = new Set(classSubjects.map((row) => row.subject_id));
    return catalog
      .filter((subject) => !attachedIds.has(subject.id))
      .map((subject) => ({
        label: catalogSubjectLabel(subject),
        value: subject.id,
      }));
  }, [catalog, classSubjects]);
  const selectedClassSubject = classSubjects.find((item) => item.id === selectedClassSubjectId);
  const assignedTeacherIds = useMemo(
    () => new Set((selectedClassSubject?.teachers ?? []).map((assignment) => assignment.teacher_id)),
    [selectedClassSubject],
  );
  const teacherOptions = useMemo(
    () =>
      teachers
        .filter((member) => {
          if (!assignedTeacherIds.has(member.user.id)) return true;
          return Boolean(
            editingAssignmentId &&
              selectedClassSubject?.teachers?.some(
                (assignment) => assignment.id === editingAssignmentId && assignment.teacher_id === member.user.id,
              ),
          );
        })
        .map((member) => ({ label: teacherLabel(member), value: member.user.id })),
    [assignedTeacherIds, editingAssignmentId, selectedClassSubject, teachers],
  );

  const assignmentRows = useMemo(
    () =>
      classes.flatMap((classItem) =>
        (classItem.classSubjects ?? []).flatMap((row) => {
          const teachers = row.teachers ?? [];
          if (teachers.length === 0) {
            return [
              {
                classId: classItem.id,
                className: classItem.class_name,
                classSubjectId: row.id,
                subjectId: row.subject_id,
                subject: subjectLabel(row),
                assignmentId: `unassigned-${row.id}`,
                teacherId: "",
                teacherName: "Unassigned",
                unassigned: true,
              },
            ];
          }
          return teachers.map((assignment) => ({
            classId: classItem.id,
            className: classItem.class_name,
            classSubjectId: row.id,
            subjectId: row.subject_id,
            subject: subjectLabel(row),
            assignmentId: assignment.id,
            teacherId: assignment.teacher_id,
            teacherName: assignmentTeacherName(assignment),
            unassigned: false,
          }));
        }),
      ),
    [classes],
  );

  const filteredAssignmentRows = useMemo(
    () =>
      assignmentRows.filter((row) => {
        if (tableClassFilter !== "all" && row.classId !== tableClassFilter) return false;
        if (tableSubjectFilter !== "all" && row.subjectId !== tableSubjectFilter) return false;
        if (tableTeacherFilter === "unassigned") return row.unassigned;
        if (tableTeacherFilter !== "all" && row.teacherId !== tableTeacherFilter) return false;
        return true;
      }),
    [assignmentRows, tableClassFilter, tableSubjectFilter, tableTeacherFilter],
  );

  const tableSubjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    assignmentRows.forEach((row) => {
      if (!seen.has(row.subjectId)) seen.set(row.subjectId, row.subject);
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [assignmentRows]);

  const tableTeacherOptions = useMemo(() => {
    const seen = new Map<string, string>();
    assignmentRows.forEach((row) => {
      if (row.unassigned) {
        seen.set("unassigned", "Unassigned");
        return;
      }
      if (!seen.has(row.teacherId)) seen.set(row.teacherId, row.teacherName);
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [assignmentRows]);

  useEffect(() => {
    if (!selectedClassId) {
      setSelectedCatalogSubjectId("");
      setSelectedClassSubjectId("");
      setSelectedTeacherId("");
      setEditingAssignmentId("");
      return;
    }
    const stillValid = attachedSubjectOptions.some((option) => option.value === selectedClassSubjectId);
    if (!stillValid) {
      setSelectedClassSubjectId("");
      setSelectedTeacherId("");
      setEditingAssignmentId("");
    }
  }, [attachedSubjectOptions, selectedClassId, selectedClassSubjectId]);

  const handleClassChange = (value: string) => {
    setSelectedClassId(value);
    setSelectedCatalogSubjectId("");
    setSelectedClassSubjectId("");
    setSelectedTeacherId("");
    setEditingAssignmentId("");
  };

  const handleAttachSubject = async () => {
    if (!selectedClassId || !selectedCatalogSubjectId) {
      triggerToast({
        title: "Class and organization subject required",
        description: "Select a class and an organization subject.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const catalogSubjectId = selectedCatalogSubjectId;
      const classId = selectedClassId;
      await axiosReq.post(`${baseUrl}/classes/${classId}/subjects`, {
        subject_id: catalogSubjectId,
      });
      setSelectedCatalogSubjectId("");
      triggerToast({
        title: "Subject assigned",
        description: "You can now assign a teacher to this class and organization subject.",
        type: "success",
      });
      const nextClasses = await load();
      const attached = nextClasses
        .find((item) => item.id === classId)
        ?.classSubjects?.find((row) => row.subject_id === catalogSubjectId);
      if (attached) {
        setSelectedClassSubjectId(attached.id);
        setSelectedTeacherId("");
        setEditingAssignmentId("");
      }
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedClassId || !selectedClassSubjectId || !selectedTeacherId) {
      triggerToast({
        title: "All fields required",
        description: "Select a class, organization subject, and teacher.",
        type: "error",
      });
      return;
    }
    setSaving(true);
    const replacing = Boolean(editingAssignmentId);
    const currentTeacherId = selectedClassSubject?.teachers?.find(
      (assignment) => assignment.id === editingAssignmentId,
    )?.teacher_id;
    try {
      if (replacing && currentTeacherId === selectedTeacherId) {
        setEditingAssignmentId("");
        setSelectedTeacherId("");
        return;
      }
      if (editingAssignmentId) {
        await axiosReq.patch(
          `${baseUrl}/classes/${selectedClassId}/subjects/${selectedClassSubjectId}/teachers/${editingAssignmentId}`,
          { teacher_id: selectedTeacherId },
        );
      } else {
        await axiosReq.post(
          `${baseUrl}/classes/${selectedClassId}/subjects/${selectedClassSubjectId}/teachers`,
          { teacher_id: selectedTeacherId },
        );
      }
      setSelectedTeacherId("");
      setEditingAssignmentId("");
      triggerToast({
        title: replacing ? "Teacher replaced" : "Teacher assigned",
        description: "The teacher can create tests for this class and organization subject.",
        type: "success",
      });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (classId: string, classSubjectId: string, assignmentId: string) => {
    setSaving(true);
    try {
      await axiosReq.delete(
        `${baseUrl}/classes/${classId}/subjects/${classSubjectId}/teachers/${assignmentId}`,
      );
      if (editingAssignmentId === assignmentId) {
        setEditingAssignmentId("");
        setSelectedTeacherId("");
      }
      triggerToast({
        title: "Assignment removed",
        description: "The teacher was unassigned from this class and organization subject.",
        type: "success",
      });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSubject = async (classId: string, classSubjectId: string) => {
    setSaving(true);
    try {
      await axiosReq.delete(`${baseUrl}/classes/${classId}/subjects/${classSubjectId}`);
      if (selectedClassSubjectId === classSubjectId) {
        setSelectedClassSubjectId("");
        setSelectedTeacherId("");
        setEditingAssignmentId("");
      }
      triggerToast({
        title: "Subject removed",
        description: "The organization subject and its class-level teacher assignments were removed.",
        type: "success",
      });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAssignment = (row: (typeof assignmentRows)[number]) => {
    setSelectedClassId(row.classId);
    setSelectedCatalogSubjectId("");
    setSelectedClassSubjectId(row.classSubjectId);
    setSelectedTeacherId(row.teacherId);
    setEditingAssignmentId(row.assignmentId);
    step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const step1SubjectPlaceholder = !selectedClassId
    ? "Select a class first"
    : attachableSubjectOptions.length === 0
      ? "All organization subjects are already assigned to this class"
      : "Select organization subject";

  const step2SubjectPlaceholder = !selectedClassId
    ? "Select a class first"
    : classSubjects.length === 0
      ? "Assign an organization subject in Step 1 first"
      : "Select organization subject";

  return (
    <div>
      <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center text-[20px] tracking-[-0.04em] md:text-[32px]">
            <p className="font-[500] text-[#232A25]">Assignments</p>
            <p className="ml-2 font-[400] italic text-[#49734F]" style={{ fontFamily: "DM Serif Display" }}>
              {activeOrganization?.name || ""}
            </p>
          </div>
          <p className="mt-1 text-[13px] text-[#747775]">Class → Organization Subject → Teacher</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[12px] bg-[#EFF0F3BF] p-2 sm:p-3">
        <div className="flex flex-col gap-3 rounded-[12px] bg-white p-3">
          <div>
            <p className="text-[16px] font-[600] text-[#232A25]">1. Assign Organization Subject to Class</p>
            <p className="text-[13px] text-[#747775]">Class → Organization Subject</p>
          </div>
          <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
            <DropDownComponent
              placeholder="Select class"
              value={selectedClassId}
              handleChange={handleClassChange}
              list={classOptions}
              isSearchable
              maxOuputInDropdownList={8}
            />
            <DropDownComponent
              placeholder={step1SubjectPlaceholder}
              value={selectedCatalogSubjectId}
              handleChange={setSelectedCatalogSubjectId}
              list={attachableSubjectOptions}
              isSearchable
              disabled={!selectedClassId}
              maxOuputInDropdownList={8}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleAttachSubject()}
              className={`h-[44px] rounded-[8px] px-4 text-sm font-medium text-white ${saving ? "bg-[#747775]" : "bg-[#49734F]"}`}
            >
              Assign Organization Subject
            </button>
          </div>
          {selectedClass && (
            <div className="rounded-[8px] border border-[#E5E5E5] p-3">
              <p className="text-[14px] font-[600] text-[#232A25]">
                Organization subjects in {selectedClass.class_name}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {classSubjects.length === 0 ? (
                  <p className="text-[13px] text-[#747775]">No organization subjects assigned yet.</p>
                ) : (
                  classSubjects.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-[8px] bg-[#F8F8F8] px-3 py-2"
                    >
                      <span className="text-sm text-[#232A25]">{subjectLabel(row)}</span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleRemoveSubject(selectedClass.id, row.id)}
                        className="text-sm font-medium text-[#C1121F]"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 py-0.5 text-center text-[13px] text-[#747775]">
          <span aria-hidden="true">↓</span>
          <p>Then assign a teacher to that class + organization subject</p>
        </div>

        <div ref={step2Ref} className="flex flex-col gap-3 rounded-[12px] bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[16px] font-[600] text-[#232A25]">2. Assign Teacher to Class & Organization Subject</p>
              <p className="text-[13px] text-[#747775]">Class + Organization Subject → Teacher</p>
            </div>
            {editingAssignmentId ? (
              <button
                type="button"
                className="text-sm font-medium text-[#747775]"
                onClick={() => {
                  setEditingAssignmentId("");
                  setSelectedTeacherId("");
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          {selectedClassId && classSubjects.length === 0 ? (
            <p className="text-[13px] text-[#747775]">
              Assign an organization subject to this class in Step 1 first.
            </p>
          ) : null}
          <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <DropDownComponent
              placeholder="Select class"
              value={selectedClassId}
              handleChange={handleClassChange}
              list={classOptions}
              isSearchable
              maxOuputInDropdownList={8}
            />
            <DropDownComponent
              placeholder={step2SubjectPlaceholder}
              value={selectedClassSubjectId}
              handleChange={(value) => {
                setSelectedClassSubjectId(value);
                setSelectedTeacherId("");
                setEditingAssignmentId("");
              }}
              list={attachedSubjectOptions}
              isSearchable
              disabled={!selectedClassId || classSubjects.length === 0}
              maxOuputInDropdownList={8}
            />
            <DropDownComponent
              placeholder={!selectedClassSubjectId ? "Select organization subject first" : "Select teacher"}
              value={selectedTeacherId}
              handleChange={setSelectedTeacherId}
              list={selectedClassSubjectId ? teacherOptions : []}
              isSearchable
              disabled={!selectedClassSubjectId}
              maxOuputInDropdownList={8}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleAssignTeacher()}
              className={`h-[44px] whitespace-nowrap rounded-[8px] px-4 text-sm font-medium text-white ${saving ? "bg-[#747775]" : "bg-[#49734F]"}`}
            >
              {editingAssignmentId ? "Replace Teacher" : "Assign Teacher"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[12px] bg-white p-3">
          <p className="text-[16px] font-[600] text-[#232A25]">3. Current Assignments</p>
          <div className="grid gap-3 md:grid-cols-3">
            <DropDownComponent
              placeholder="All classes"
              value={tableClassFilter}
              handleChange={setTableClassFilter}
              list={[{ label: "All classes", value: "all" }, ...classOptions]}
              isSearchable
              maxOuputInDropdownList={8}
            />
            <DropDownComponent
              placeholder="All organization subjects"
              value={tableSubjectFilter}
              handleChange={setTableSubjectFilter}
              list={[{ label: "All organization subjects", value: "all" }, ...tableSubjectOptions]}
              isSearchable
              maxOuputInDropdownList={8}
            />
            <DropDownComponent
              placeholder="All teachers"
              value={tableTeacherFilter}
              handleChange={setTableTeacherFilter}
              list={[{ label: "All teachers", value: "all" }, ...tableTeacherOptions]}
              isSearchable
              maxOuputInDropdownList={8}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#EFF0F3] text-left text-[#232A25]">
                <tr>
                  <th className="p-3">Class</th>
                  <th className="p-3">Organization Subject</th>
                  <th className="p-3">Teacher</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[#747775]">
                      Loading assignments...
                    </td>
                  </tr>
                ) : filteredAssignmentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[#747775]">
                      No class–organization subject rows yet. Complete Step 1.
                    </td>
                  </tr>
                ) : (
                  filteredAssignmentRows.map((row) => (
                    <tr key={row.assignmentId} className="border-t border-[#F0F0F0]">
                      <td className="p-3 text-[#232A25]">{row.className}</td>
                      <td className="p-3 text-[#232A25]">{row.subject}</td>
                      <td className="p-3 text-[#232A25]">{row.teacherName}</td>
                      <td className="p-3">
                        {row.unassigned ? (
                          <span className="text-[#747775]">Assign a teacher in Step 2</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleEditAssignment(row)}
                              className="font-medium text-[#49734F]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleUnassign(row.classId, row.classSubjectId, row.assignmentId)}
                              className="font-medium text-[#C1121F]"
                            >
                              Remove
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
      </div>
    </div>
  );
};

const OrganizationAssignments = () => (
  <OrganizationWorkspaceGate title="Teacher assignments" allowedRoles={["OWNER", "ADMIN", "ASSISTANT"]}>
    <OrganizationAssignmentsContent />
  </OrganizationWorkspaceGate>
);

export default OrganizationAssignments;
