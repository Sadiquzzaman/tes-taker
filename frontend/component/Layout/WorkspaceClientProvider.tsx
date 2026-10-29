"use client";

import EntitlementsProvider from "@/component/Subscription/EntitlementsProvider";
import LockedFeatureProvider from "@/component/Subscription/LockedFeatureProvider";
import { WorkspaceProvider } from "@/hooks/organization/useWorkspace";

const WorkspaceClientProvider = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceProvider>
    <EntitlementsProvider>
      <LockedFeatureProvider>{children}</LockedFeatureProvider>
    </EntitlementsProvider>
  </WorkspaceProvider>
);

export default WorkspaceClientProvider;
