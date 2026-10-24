"use client";

import useWorkspace from "@/hooks/organization/useWorkspace";
import OrganizationWorkspaceGate from "@/component/Organization/OrganizationWorkspaceGate";

export default function OrganizationPendingContent() {
  const { activeOrganization } = useWorkspace();

  return (
    <OrganizationWorkspaceGate allowPending>
      <div className="bg-canvas rounded-card p-6 sm:p-10 min-h-[calc(100vh-162px)]">
        <div className="max-w-xl bg-surface rounded-card border border-border p-6">
          <h1 className="text-title font-medium text-ink">
            Your organization registration is under review
          </h1>
          <p className="mt-3 text-body-sm text-ink-muted leading-relaxed">
            {activeOrganization?.name
              ? `"${activeOrganization.name}" `
              : "Your organization "}
            is waiting for Super Admin approval. You can sign in to this account, but organization
            teaching, member management, and class creation stay locked until approval.
          </p>
          {activeOrganization?.public_id && (
            <p className="mt-4 text-body-sm text-ink">
              Organization ID: <span className="font-medium">{activeOrganization.public_id}</span>
            </p>
          )}
        </div>
      </div>
    </OrganizationWorkspaceGate>
  );
}
