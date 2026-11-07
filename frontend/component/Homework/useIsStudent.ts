"use client";

import useWorkspace from "@/hooks/organization/useWorkspace";
import { useIsClient } from "@/hooks/useBrowserStorage";
import { getStoredUser } from "@/lib/authSession";

/** Whether the signed-in user is a student here; undefined while hydrating. */
const useIsStudent = (): boolean | undefined => {
  const isClient = useIsClient();
  const { memberRole } = useWorkspace();
  if (!isClient) return undefined;
  return memberRole === "STUDENT" || (!memberRole && getStoredUser()?.role === "STUDENT");
};

export default useIsStudent;
