"use client";

import { WorkspaceProvider } from "@/hooks/organization/useWorkspace";

const WorkspaceClientProvider = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

export default WorkspaceClientProvider;
