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
      <div className="rounded-[8px] bg-white p-6">
        <p className="text-[14px] text-[#747775]">Loading workspace...</p>
      </div>
    );
  }

  if (sessionMode !== "organization" || !organizationId || !activeOrganization) {
    return (
      <div className="rounded-[8px] bg-white p-6">
        <p className="text-[24px] font-[500] leading-[28px] tracking-[-0.02em] text-[#232A25]">
          {title}
        </p>
        <p className="mt-2 text-[14px] text-[#747775]">
          {description ||
            "Select an organization from the workspace switcher, or use organization login."}
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-[14px] font-[500] text-[#49734F] underline"
        >
          Choose workspace
        </Link>
      </div>
    );
  }

  if (!allowPending && activeOrganization.status === "pending") {
    return (
      <div className="rounded-[8px] bg-white p-6">
        <p className="text-[20px] font-[500] text-[#232A25]">
          Your organization registration is under review
        </p>
        <p className="mt-2 text-[14px] text-[#747775]">
          Organization features are locked until Super Admin approval.
        </p>
        <Link
          href="/organization/pending"
          className="mt-4 inline-block text-[14px] font-[500] text-[#49734F] underline"
        >
          View status
        </Link>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(activeOrganization.role)) {
    return (
      <div className="rounded-[8px] bg-white p-6">
        <p className="text-[20px] font-[500] text-[#232A25]">You do not have access</p>
        <p className="mt-2 text-[14px] text-[#747775]">
          This page is not available for your role in this organization.
        </p>
        <Link
          href="/organization/classes"
          className="mt-4 inline-block text-[14px] font-[500] text-[#49734F] underline"
        >
          Go to classes
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

export default OrganizationWorkspaceGate;
