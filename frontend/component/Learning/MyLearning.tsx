"use client";

import { useMemo, useState } from "react";
import useWorkspace from "@/hooks/organization/useWorkspace";

/**
 * Student aggregate learning view across personal classes and organizations.
 */
export default function MyLearningPage() {
  const { organizations } = useWorkspace({ loadOrganizations: true });
  const [filter, setFilter] = useState<string>("all");

  const filters = useMemo(() => {
    const items = [{ id: "all", label: "All" }];
    for (const org of organizations) {
      items.push({ id: org.id, label: org.name });
    }
    return items;
  }, [organizations]);

  const visible =
    filter === "all" ? organizations : organizations.filter((o) => o.id === filter);

  return (
    <div className="min-h-[calc(100vh-162px)]">
      <div className="mb-4">
        <h1 className="text-[28px] md:text-[32px] font-[500] text-[#232A25] tracking-[-0.04em]">
          My Learning
        </h1>
        <p className="mt-1 text-[14px] text-[#747775]">
          Classes and tests across every organization and teacher you belong to.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-[8px] px-3 py-1.5 text-[13px] border ${
              filter === item.id
                ? "bg-[#EAF2EB] border-[#49734F] text-[#49734F]"
                : "bg-white border-[#E5E5E5] text-[#232A25]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-4 sm:p-6">
        {visible.length === 0 ? (
          <div className="bg-white rounded-[12px] p-6 text-[14px] text-[#747775]">
            You are not enrolled in any organizations yet. Join a class invite to get started, or open
            Classes from the sidebar for personal class memberships.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((org) => (
              <div key={org.id} className="bg-white rounded-[12px] p-4 border border-[#E5E5E5]">
                <p className="text-[16px] font-[500] text-[#232A25]">{org.name}</p>
                <p className="text-[12px] text-[#747775] mt-1">
                  {org.public_id || org.organization_number
                    ? `ID ${org.public_id || org.organization_number} · `
                    : ""}
                  Role {org.role} · Status {org.status}
                </p>
                <p className="text-[13px] text-[#747775] mt-3">
                  Use the workspace switcher to enter this organization, then open Classes or Tests.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
