"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, ChevronRightIcon, cn, EmptyState, focusRing, Skeleton, Spinner } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";

const isStudentContext = (context: UserContextItem) =>
  context.type === "individual_teacher" || (context.type === "organization" && context.member_role === "STUDENT");

/** The student home: the organisations and teachers they study with. Opening one switches workspace. */
const StudentWorkspaceCards = () => {
  const t = useTranslations("dashboard.student");
  const router = useRouter();
  const { contexts, selectContext, loading, workspace } = useWorkspace({ loadOrganizations: true });
  const [selectingKey, setSelectingKey] = useState<string | null>(null);

  const studentContexts = useMemo(
    () => contexts.filter((context) => context.actionable && isStudentContext(context)),
    [contexts],
  );

  const subtitle = (context: UserContextItem) => {
    if (context.type === "individual_teacher") {
      return t("teacher");
    }
    if (context.type === "organization") {
      const id = context.organization_public_id || context.organization_number;
      const status = context.organization_status === "pending" ? t("pendingApproval") : t("organization");
      return [id ? t("orgId", { id }) : null, status].filter(Boolean).join(" · ");
    }
    return context.role_label;
  };

  const isActive = (context: UserContextItem) =>
    (context.type === "organization" && workspace.type === "organization" && workspace.id === context.organization_id) ||
    (context.type === "individual_teacher" &&
      workspace.type === "individual_teacher" &&
      workspace.teacherId === context.teacher_id);

  const open = async (context: UserContextItem) => {
    if (selectingKey) return;
    setSelectingKey(context.key);
    try {
      const result = await selectContext(context);
      if (result.href !== window.location.pathname) {
        router.push(result.href);
      }
      router.refresh();
    } catch {
      // Errors are shown by the axios interceptors / toasts.
    } finally {
      setSelectingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-card border border-border bg-surface p-5">
            <Skeleton lines={3} />
          </div>
        ))}
      </div>
    );
  }

  if (studentContexts.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState title={t("empty")} description={t("emptyDetail")} />
      </div>
    );
  }

  return (
    <section aria-label={t("title")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {studentContexts.map((context) => {
        const active = isActive(context);
        const pending = context.organization_status === "pending";
        const busy = selectingKey === context.key;

        return (
          <button
            key={context.key}
            type="button"
            disabled={Boolean(selectingKey) || pending}
            aria-current={active || undefined}
            onClick={() => void open(context)}
            className={cn(
              "flex flex-col gap-4 rounded-card border bg-surface p-5 text-left shadow-card transition-colors duration-(--motion-fast)",
              "disabled:cursor-not-allowed disabled:opacity-60",
              active ? "border-primary bg-primary-soft" : "border-border hover:border-primary",
              focusRing,
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-title-sm font-semibold text-ink">{context.label}</span>
                <span className="text-body-sm text-ink-muted">{subtitle(context)}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  active ? "bg-primary text-ink-inverse" : "bg-canvas text-primary",
                )}
              >
                {busy ? <Spinner /> : <ChevronRightIcon />}
              </span>
            </span>
            <span className="flex items-center justify-between gap-2">
              <Badge tone={pending ? "warning" : "primary"}>{pending ? t("pending") : t("student")}</Badge>
              <span className="text-body-sm font-medium text-primary">
                {busy ? t("opening") : pending ? t("unavailable") : active ? t("continue") : t("open")}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
};

export default StudentWorkspaceCards;
