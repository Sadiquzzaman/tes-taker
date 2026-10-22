"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useWorkspace from "@/hooks/organization/useWorkspace";

const WorkspaceSwitcher = () => {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { workspace, contexts, selectContext, loading, activeOrganization } = useWorkspace();

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!contexts.length) {
    return null;
  }

  const activeContext = contexts.find((context) => {
    if (context.type === "organization" && workspace.type === "organization") {
      return workspace.id === context.organization_id;
    }
    if (context.type === "personal_teacher" && workspace.type === "personal_teacher") {
      return true;
    }
    if (context.type === "individual_teacher" && workspace.type === "individual_teacher") {
      return workspace.teacherId === context.teacher_id;
    }
    return false;
  });

  const label = activeContext?.label
    || (workspace.type === "organization"
      ? activeOrganization?.name || workspace.name || "Organization"
      : workspace.type === "personal_teacher"
        ? "My Teaching"
        : workspace.type === "individual_teacher"
          ? workspace.name || "Classes"
          : "Workspace");

  const onSelect = async (context: UserContextItem) => {
    try {
      const result = await selectContext(context);
      setOpen(false);
      if (result.href !== window.location.pathname) {
        router.push(result.href);
      }
      router.refresh();
    } catch {
      // axios / toast elsewhere
    }
  };

  if (contexts.length === 1) {
    return (
      <div className="max-w-[240px] rounded-[8px] border border-[#E5E5E5] px-3 py-1.5">
        <span className="block min-w-0 truncate text-[13px] font-[500] text-[#232A25]">{label}</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex max-w-[240px] items-center gap-2 rounded-[8px] border border-[#E5E5E5] px-3 py-1.5 text-left hover:border-[#49734F]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate text-[13px] font-[500] text-[#232A25]">{label}</span>
        <span className="text-[10px] text-[#747775]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[280px] max-h-[70vh] overflow-y-auto rounded-[8px] border border-[#E5E5E5] bg-white p-2 shadow-sm">
          <p className="px-2 pb-2 text-[12px] font-[500] uppercase tracking-[0.02em] text-[#747775]">
            Workspaces
          </p>

          {loading ? (
            <p className="px-3 py-2 text-[13px] text-[#747775]">Loading...</p>
          ) : (
            contexts.map((context) => {
              const isActive = activeContext?.key === context.key;
              const pending = context.organization_status === "pending";

              return (
                <button
                  key={context.key}
                  type="button"
                  onClick={() => void onSelect(context)}
                  className={`mb-1 flex w-full flex-col rounded-[8px] px-3 py-2 text-left ${
                    isActive
                      ? "bg-[#EAF2EB] text-[#49734F]"
                      : "text-[#232A25] hover:bg-[#F7F7F7]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-[500]">{context.label}</span>
                    {pending && (
                      <span className="shrink-0 rounded-full bg-[#FFF4E5] px-2 py-0.5 text-[11px] font-[500] text-[#B54708]">
                        Review
                      </span>
                    )}
                  </span>
                  <span className="text-[12px] text-[#747775]">{context.role_label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
