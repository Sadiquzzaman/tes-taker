"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonClasses, Card, EmptyState, Skeleton } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";

const GateMessage = ({ title, description, href, label }: { title: string; description: string; href: string; label: string }) => (
  <Card>
    <EmptyState
      title={title}
      description={description}
      action={
        <NextLink href={href} className={buttonClasses({ variant: "secondary" })}>
          {label}
        </NextLink>
      }
    />
  </Card>
);

/** Shows organisation pages only inside an approved organisation workspace, to the roles allowed. */
const OrganizationWorkspaceGate = ({
  children,
  allowPending = false,
  allowedRoles,
}: {
  children: ReactNode;
  /** When true, pending org sessions can view the children (e.g. review screen). */
  allowPending?: boolean;
  allowedRoles?: OrganizationMemberRole[];
}) => {
  const t = useTranslations("organization.gate");
  const { loading, organizationId, activeOrganization, sessionMode } = useWorkspace();

  if (loading) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={3} />
      </Card>
    );
  }

  if (sessionMode !== "organization" || !organizationId || !activeOrganization) {
    return <GateMessage title={t("noWorkspaceTitle")} description={t("noWorkspace")} href="/dashboard" label={t("chooseWorkspace")} />;
  }

  if (!allowPending && activeOrganization.status === "pending") {
    return <GateMessage title={t("pendingTitle")} description={t("pending")} href="/organization/pending" label={t("viewStatus")} />;
  }

  if (allowedRoles && !allowedRoles.includes(activeOrganization.role)) {
    return <GateMessage title={t("noAccessTitle")} description={t("noAccess")} href="/organization/classes" label={t("goToClasses")} />;
  }

  return <>{children}</>;
};

export default OrganizationWorkspaceGate;
