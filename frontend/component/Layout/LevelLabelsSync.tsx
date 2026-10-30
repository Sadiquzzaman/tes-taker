"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import useWorkspace from "@/hooks/organization/useWorkspace";
import { toLevelLabels, writeLevelLabelsCookie, type LevelLabels } from "@/i18n/levelLabels";
import { getStoredUser } from "@/lib/authSession";
import axiosReq from "@/lib/axios";

/**
 * Keeps the level names (FND-03) of the current workspace on this device: loads them once per
 * page load and on every workspace switch, and re-renders the page when they changed (the server
 * reads them from the cookie, like the language). Renders nothing.
 */
const LevelLabelsSync = () => {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [, startTransition] = useTransition();
  const workspaceKey =
    workspace.type === "organization" ? `org:${workspace.id}` : workspace.type === "individual_teacher" ? `teacher:${workspace.teacherId}` : workspace.type;

  useEffect(() => {
    if (!getStoredUser()?.access_token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await axiosReq.get<ApiResponse<LevelLabels>>(`${process.env.NEXT_PUBLIC_BASE_URL}/workspace/level-labels`);
        if (!cancelled && writeLevelLabelsCookie(toLevelLabels(res.data?.payload))) {
          startTransition(() => router.refresh());
        }
      } catch {
        // Keep the names this device has (e.g. an organisation still waiting for approval).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, workspaceKey]);

  return null;
};

export default LevelLabelsSync;
