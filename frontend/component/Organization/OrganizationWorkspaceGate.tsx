"use client";

import Link from "next/link";
import useWorkspace from "@/hooks/organization/useWorkspace";

const OrganizationWorkspaceGate = ({
  children,
  title = "Organization workspace required",
  description,
  allowPending = false,
  allowedRoles,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  /** When true, pending org sessions can view the children (e.g. review screen). */
  allowPending?: boolean;
  allowedRoles?: OrganizationMemberRole[];
}) => {
  const { loading, organizationId, activeOrganization, sessionMode } = useWorkspace();

  if (loading) {
    return (
      <div className="rounded-input bg-surface p-6">
        <p className="text-body-sm text-ink-muted">Loading workspace...</p>
      </div>
    );
  }

  if (sessionMode !== "organization" || !organizationId || !activeOrganization) {
    return (
      <div className="rounded-input bg-surface p-6">
        <p className="text-title font-medium text-ink">
          {title}
        </p>
        <p className="mt-2 text-body-sm text-ink-muted">
          {description ||
            "Select an organization from the workspace switcher, or use organization login."}
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-body-sm font-medium text-primary underline"
        >
          Choose workspace
        </Link>
      </div>
    );
  }

  if (!allowPending && activeOrganization.status === "pending") {
    return (
      <div className="rounded-input bg-surface p-6">
        <p className="text-title-sm font-medium text-ink">
          Your organization registration is under review
        </p>
        <p className="mt-2 text-body-sm text-ink-muted">
          Organization features are locked until Super Admin approval.
        </p>
        <Link
          href="/organization/pending"
          className="mt-4 inline-block text-body-sm font-medium text-primary underline"
        >
          View status
        </Link>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(activeOrganization.role)) {
    return (
      <div className="rounded-input bg-surface p-6">
        <p className="text-title-sm font-medium text-ink">You do not have access</p>
        <p className="mt-2 text-body-sm text-ink-muted">
          This page is not available for your role in this organization.
        </p>
        <Link
          href="/organization/classes"
          className="mt-4 inline-block text-body-sm font-medium text-primary underline"
        >
          Go to classes
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

export default OrganizationWorkspaceGate;
