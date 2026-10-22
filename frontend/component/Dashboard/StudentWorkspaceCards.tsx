"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useWorkspace from "@/hooks/organization/useWorkspace";
import RightArrowIconSVG from "@/component/svg/RightArrowIconSVG";

const isStudentContext = (context: UserContextItem) => {
  if (context.type === "individual_teacher") {
    return true;
  }
  if (context.type === "organization" && context.member_role === "STUDENT") {
    return true;
  }
  return false;
};

const contextSubtitle = (context: UserContextItem) => {
  if (context.type === "organization") {
    const idPart =
      context.organization_public_id || context.organization_number
        ? `ID ${context.organization_public_id || context.organization_number}`
        : null;
    const status =
      context.organization_status === "pending"
        ? "Pending approval"
        : context.organization_status === "approved"
          ? "Organization"
          : context.organization_status || "Organization";
    return [idPart, status].filter(Boolean).join(" · ");
  }
  if (context.type === "individual_teacher") {
    return "Teacher / coaching classes";
  }
  return context.role_label;
};

const StudentWorkspaceCards = () => {
  const router = useRouter();
  const { contexts, selectContext, loading, workspace } = useWorkspace({
    loadOrganizations: true,
  });
  const [selectingKey, setSelectingKey] = useState<string | null>(null);

  const studentContexts = useMemo(
    () => contexts.filter((context) => context.actionable && isStudentContext(context)),
    [contexts],
  );

  const isActive = (context: UserContextItem) => {
    if (context.type === "organization" && workspace.type === "organization") {
      return workspace.id === context.organization_id;
    }
    if (context.type === "individual_teacher" && workspace.type === "individual_teacher") {
      return workspace.teacherId === context.teacher_id;
    }
    return false;
  };

  const onOpenWorkspace = async (context: UserContextItem) => {
    if (selectingKey) return;
    setSelectingKey(context.key);
    try {
      const result = await selectContext(context);
      if (result.href !== window.location.pathname) {
        router.push(result.href);
      }
      router.refresh();
    } catch {
      // Errors surfaced by axios interceptors / toasts.
    } finally {
      setSelectingKey(null);
    }
  };

  return (
    <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)]">
      <div className="mb-4 px-1 sm:px-2">
        <p className="font-[500] text-[16px] sm:text-[18px] text-[#232A25] tracking-[-0.02em]">
          Your workspaces
        </p>
        <p className="mt-1 text-[13px] sm:text-[14px] text-[#747775] tracking-[-0.02em]">
          Choose an organization or teacher to view classes and tests.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-[140px] rounded-[12px] bg-white border border-[#E5E5E5] animate-pulse"
            />
          ))}
        </div>
      ) : studentContexts.length === 0 ? (
        <div className="bg-white rounded-[12px] p-6 border border-[#E5E5E5]">
          <p className="font-[500] text-[16px] text-[#232A25]">No workspaces yet</p>
          <p className="mt-2 text-[14px] text-[#747775] leading-[20px]">
            Join a class with an invite link from your teacher or organization. Once you belong to a
            class, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {studentContexts.map((context) => {
            const active = isActive(context);
            const pending = context.organization_status === "pending";
            const busy = selectingKey === context.key;

            return (
              <button
                key={context.key}
                type="button"
                disabled={Boolean(selectingKey) || pending}
                onClick={() => void onOpenWorkspace(context)}
                className={`text-left rounded-[12px] bg-white border p-4 sm:p-5 transition-colors disabled:opacity-70 ${
                  active
                    ? "border-[#49734F] bg-[#EAF2EB]"
                    : "border-[#E5E5E5] hover:border-[#49734F]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="font-[500] text-[18px] sm:text-[20px] text-[#232A25] tracking-[-0.04em] truncate"
                      style={
                        context.type === "organization"
                          ? undefined
                          : { fontFamily: "DM Serif Display", fontStyle: "italic", fontWeight: 400 }
                      }
                    >
                      {context.label}
                    </p>
                    <p className="mt-2 text-[13px] text-[#747775] tracking-[-0.02em]">
                      {contextSubtitle(context)}
                    </p>
                  </div>
                  <span
                    className={`mt-1 shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${
                      active ? "bg-[#49734F] text-white" : "bg-[#EFF0F3] text-[#49734F]"
                    }`}
                  >
                    <RightArrowIconSVG className="size-4" />
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-[8px] bg-[#EFF0F3] px-2.5 py-1 text-[12px] font-[500] text-[#232A25]">
                    {pending ? "Pending" : "Student"}
                  </span>
                  <span className="text-[13px] font-[500] text-[#49734F]">
                    {busy ? "Opening..." : pending ? "Unavailable" : active ? "Continue" : "Open"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentWorkspaceCards;
