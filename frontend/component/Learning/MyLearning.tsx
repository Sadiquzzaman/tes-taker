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
        <h1 className="text-display md:text-display font-medium text-ink tracking-tight">
          My Learning
        </h1>
        <p className="mt-1 text-body-sm text-ink-muted">
          Classes and tests across every organization and teacher you belong to.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-input px-3 py-1.5 text-body-sm border ${
              filter === item.id
                ? "bg-primary-soft border-primary text-primary"
                : "bg-surface border-border text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="bg-canvas rounded-card p-4 sm:p-6">
        {visible.length === 0 ? (
          <div className="bg-surface rounded-card p-6 text-body-sm text-ink-muted">
            You are not enrolled in any organizations yet. Join a class invite to get started, or open
            Classes from the sidebar for personal class memberships.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((org) => (
              <div key={org.id} className="bg-surface rounded-card p-4 border border-border">
                <p className="text-body font-medium text-ink">{org.name}</p>
                <p className="text-caption text-ink-muted mt-1">
                  {org.public_id || org.organization_number
                    ? `ID ${org.public_id || org.organization_number} · `
                    : ""}
                  Role {org.role} · Status {org.status}
                </p>
                <p className="text-body-sm text-ink-muted mt-3">
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
