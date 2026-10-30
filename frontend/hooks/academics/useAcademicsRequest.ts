import { AxiosError } from "axios";
import { useCallback } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import { getStoredUser } from "@/lib/authSession";

const MANAGE_STRUCTURE: OrganizationMemberRole[] = ["OWNER", "ADMIN", "ASSISTANT"];
const MANAGE_SESSIONS: OrganizationMemberRole[] = ["OWNER", "ADMIN"];

/**
 * Shared plumbing for the academic-structure screens (P2-03): one way to call the API with the
 * usual error handling and a success toast, and who may change what in the current workspace
 * (a solo teacher owns their own workspace; the API checks the same rules).
 */
export default function useAcademicsRequest() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const { isIndividual, activeOrganization, organizationId } = useWorkspace();
  const role = activeOrganization?.role;
  // The teacher's own workspace (P2-01): a personal session with personal teaching on. Read from the
  // signed-in session itself, not the workspace state, which starts as "personal" until it loads;
  // a teacher with personal teaching off has no workspace of their own to manage.
  const user = getStoredUser();
  const ownsPersonalWorkspace = user?.session_mode !== "organization" && user?.personal_teacher_enabled === true;

  /** Runs a request; on success shows `success` (if given) and returns the result, on failure shows the error and returns null. */
  const run = useCallback(
    async <T>(request: () => Promise<T>, success?: string): Promise<T | null> => {
      try {
        const result = await request();
        if (success) triggerToast({ title: success, type: "success" });
        return result;
      } catch (error) {
        handleError(error as AxiosError<ApiError>);
        return null;
      }
    },
    [handleError, triggerToast],
  );

  return {
    baseUrl,
    run,
    isIndividual,
    organizationId,
    canManageStructure: ownsPersonalWorkspace || Boolean(!isIndividual && role && MANAGE_STRUCTURE.includes(role)),
    canManageSessions: ownsPersonalWorkspace || Boolean(!isIndividual && role && MANAGE_SESSIONS.includes(role)),
    canReopenSessions: ownsPersonalWorkspace || (!isIndividual && role === "OWNER"),
  };
}
