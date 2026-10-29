import { getStoredUser } from "@/lib/authSession";
import { useIsClient } from "@/hooks/useBrowserStorage";
import useWorkspace from "./useWorkspace";

/**
 * Who may manage the current workspace's plan (P2-02): a teacher in their own (solo) workspace,
 * or a school's OWNER or ADMIN. Everyone else is told to ask their admin (FND-07).
 */
const useBillingAccess = () => {
  const isClient = useIsClient();
  const { isIndividual, memberRole } = useWorkspace();
  const role = isClient ? (getStoredUser()?.role as RoleUserType | undefined) : undefined;
  const canManageBilling =
    role === "TEACHER" && (isIndividual || memberRole === "OWNER" || memberRole === "ADMIN");
  return { role, canManageBilling };
};

export default useBillingAccess;
