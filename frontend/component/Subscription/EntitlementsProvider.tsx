"use client";

import { EntitlementsContext, useEntitlementsState } from "@/hooks/api/subscription/useEntitlements";
import useBillingAccess from "@/hooks/organization/useBillingAccess";
import useWorkspace from "@/hooks/organization/useWorkspace";
import { useIsClient } from "@/hooks/useBrowserStorage";

/**
 * Loads the current workspace's entitlements once per page load and shares them, so menus and
 * screens agree (FND-07: changes show at the next page load). Teachers only: students and
 * platform admins have no plan of their own.
 */
const EntitlementsProvider = ({ children }: { children: React.ReactNode }) => {
  const { role } = useBillingAccess();
  const { workspace } = useWorkspace();
  const reloadKey = workspace.type === "organization" ? `org:${workspace.id}` : workspace.type;
  const isClient = useIsClient();
  // The role is read from browser storage, so it is unknown during the server render.
  const state = useEntitlementsState(isClient ? role === "TEACHER" : null, reloadKey);
  return <EntitlementsContext.Provider value={state}>{children}</EntitlementsContext.Provider>;
};

export default EntitlementsProvider;
