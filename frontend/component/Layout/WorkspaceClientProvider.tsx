"use client";

import EntitlementsProvider from "@/component/Subscription/EntitlementsProvider";
import LockedFeatureProvider from "@/component/Subscription/LockedFeatureProvider";
import { WorkspaceProvider } from "@/hooks/organization/useWorkspace";
import LevelLabelsSync from "./LevelLabelsSync";

const WorkspaceClientProvider = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceProvider>
    <LevelLabelsSync />
    <EntitlementsProvider>
      <LockedFeatureProvider>{children}</LockedFeatureProvider>
    </EntitlementsProvider>
  </WorkspaceProvider>
);

export default WorkspaceClientProvider;
