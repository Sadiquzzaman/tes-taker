"use client";

import useWorkspace from "@/hooks/organization/useWorkspace";

/**
 * Whether a personal-calendar item belongs to the workspace the person is in now: only then do its
 * pages (the event, the homework, the Routine) open, since they read the chosen workspace.
 */
const useIsHere = () => {
  const { contextType, organizationId } = useWorkspace();
  const hereKey = contextType === "organization" && organizationId ? `org:${organizationId}` : contextType === "personal_teacher" ? "personal_teacher" : null;
  return (item: CalendarFeedItem) =>
    !item.workspace || item.workspace.key === hereKey || (contextType === "individual_teacher" && item.workspace.key.startsWith("teacher:"));
};

export default useIsHere;
