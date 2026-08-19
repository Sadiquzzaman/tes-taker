"use client";

import useWorkspace from "@/hooks/organization/useWorkspace";
import OrganizationWorkspaceGate from "@/component/Organization/OrganizationWorkspaceGate";

export default function OrganizationPendingContent() {
  const { activeOrganization } = useWorkspace();

  return (
    <OrganizationWorkspaceGate allowPending>
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-6 sm:p-10 min-h-[calc(100vh-162px)]">
        <div className="max-w-xl bg-white rounded-[12px] border border-[#E5E5E5] p-6">
          <h1 className="text-[24px] font-[500] text-[#232A25]">
            Your organization registration is under review
          </h1>
          <p className="mt-3 text-[14px] text-[#747775] leading-relaxed">
            {activeOrganization?.name
              ? `"${activeOrganization.name}" `
              : "Your organization "}
            is waiting for Super Admin approval. You can sign in to this account, but organization
            teaching, member management, and class creation stay locked until approval.
          </p>
          {activeOrganization?.public_id && (
            <p className="mt-4 text-[13px] text-[#232A25]">
              Organization ID: <span className="font-[500]">{activeOrganization.public_id}</span>
            </p>
          )}
        </div>
      </div>
    </OrganizationWorkspaceGate>
  );
}
