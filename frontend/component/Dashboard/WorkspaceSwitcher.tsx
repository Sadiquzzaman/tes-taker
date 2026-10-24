"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import useWorkspace from "@/hooks/organization/useWorkspace";
import { Badge, ChevronDownIcon, cn, focusRing } from "@/design/ui";

const WorkspaceSwitcher = () => {
  const router = useRouter();
  const t = useTranslations();
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
      ? activeOrganization?.name || workspace.name || t("shell.organization")
      : workspace.type === "personal_teacher"
        ? t("shell.workspace.myTeaching")
        : workspace.type === "individual_teacher"
          ? workspace.name || t("shell.workspace.classes")
          : t("shell.workspace.fallback"));

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
      <div className="hidden max-w-60 rounded-input border border-border px-3 py-1.5 sm:block">
        <span className="block min-w-0 truncate text-body-sm font-medium text-ink">{label}</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex max-w-36 items-center gap-2 rounded-input border border-border px-3 py-1.5 text-left hover:border-primary sm:max-w-60",
          focusRing,
        )}
        aria-expanded={open}
      >
        <span className="min-w-0 truncate text-body-sm font-medium text-ink">{label}</span>
        <ChevronDownIcon className={cn("text-ink-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-overlay">
          <p className="px-2 pb-2 text-caption font-medium uppercase tracking-wide text-ink-muted">
            {t("shell.workspace.title")}
          </p>

          {loading ? (
            <p className="px-3 py-2 text-body-sm text-ink-muted">{t("common.loading")}</p>
          ) : (
            contexts.map((context) => {
              const isActive = activeContext?.key === context.key;
              const pending = context.organization_status === "pending";

              return (
                <button
                  key={context.key}
                  type="button"
                  onClick={() => void onSelect(context)}
                  aria-current={isActive || undefined}
                  className={cn(
                    "mb-1 flex w-full flex-col rounded-input px-3 py-2 text-left",
                    isActive ? "bg-primary-soft text-primary" : "text-ink hover:bg-canvas",
                    focusRing,
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-body-sm font-medium">{context.label}</span>
                    {pending && <Badge tone="warning">{t("shell.workspace.review")}</Badge>}
                  </span>
                  <span className="text-caption text-ink-muted">{context.role_label}</span>
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
