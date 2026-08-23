"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/axios";
import { getStoredUser, persistAuthSession } from "@/lib/authSession";
import {
  getStoredWorkspace,
  homeForContext,
  setLastWorkspace,
  setStoredWorkspace,
  workspaceFromContext,
  workspaceFromUser,
} from "@/lib/workspace";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

type WorkspaceContextValue = {
  workspace: WorkspaceSelection;
  setWorkspace: (next: WorkspaceSelection) => Promise<void>;
  selectContext: (context: UserContextItem) => Promise<{ payload: LoginResponsePayload; href: string }>;
  homeForContext: typeof homeForContext;
  contexts: UserContextItem[];
  organizations: OrganizationWorkspaceItem[];
  approvedOrganizations: OrganizationWorkspaceItem[];
  pendingOrganizations: OrganizationWorkspaceItem[];
  activeOrganization: OrganizationWorkspaceItem | null;
  isIndividual: boolean;
  organizationId: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
  sessionMode: SessionMode;
  contextType?: ContextType;
  memberRole?: OrganizationMemberRole;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const [workspace, setWorkspaceState] = useState<WorkspaceSelection>({ type: "individual" });
  const [sessionUser, setSessionUser] = useState<LoginResponsePayload | null>(null);
  const [contexts, setContexts] = useState<UserContextItem[]>([]);
  const [loading, setLoading] = useState(false);

  const syncFromUser = useCallback((user: LoginResponsePayload | null) => {
    setSessionUser(user);
    const next = user ? workspaceFromUser(user) : getStoredWorkspace();
    if (next.type !== "individual") {
      setStoredWorkspace(next);
    }
    setWorkspaceState(next);
  }, []);

  const loadContexts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ payload: UserContextItem[] }>(`${baseUrl}/auth/contexts`);
      setContexts(res.data?.payload ?? []);
    } catch {
      setContexts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    syncFromUser(user);
    if (user?.access_token) {
      void loadContexts();
    }
  }, [loadContexts, syncFromUser]);

  useEffect(() => {
    const onWorkspaceChanged = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceSelection>).detail;
      if (detail) {
        setWorkspaceState(detail);
      }
    };
    window.addEventListener("workspace-changed", onWorkspaceChanged);
    return () => window.removeEventListener("workspace-changed", onWorkspaceChanged);
  }, []);

  const selectContext = useCallback(
    async (context: UserContextItem) => {
      const body =
        context.type === "organization"
          ? { type: "organization", organization_id: context.organization_id }
          : context.type === "individual_teacher"
            ? { type: "individual_teacher", teacher_id: context.teacher_id }
            : { type: context.type };

      const res = await apiClient.post<{ payload: LoginResponsePayload }>(
        `${baseUrl}/auth/select-context`,
        body,
      );
      const payload = res.data.payload;
      await persistAuthSession(payload);
      const nextWorkspace = workspaceFromContext(context);
      setStoredWorkspace(nextWorkspace);
      if (payload.id) {
        setLastWorkspace(payload.id, nextWorkspace);
      }
      syncFromUser(payload);
      setContexts(payload.contexts ?? []);
      return { payload, href: homeForContext(context, payload.role as string) };
    },
    [syncFromUser],
  );

  const setWorkspace = useCallback(
    async (next: WorkspaceSelection) => {
      if (next.type === "organization") {
        const match = contexts.find(
          (c) => c.type === "organization" && c.organization_id === next.id,
        );
        if (match) {
          await selectContext(match);
          return;
        }
      }
      if (next.type === "personal_teacher") {
        const match = contexts.find((c) => c.type === "personal_teacher");
        if (match) {
          await selectContext(match);
          return;
        }
      }
      if (next.type === "individual_teacher") {
        const match = contexts.find(
          (c) => c.type === "individual_teacher" && c.teacher_id === next.teacherId,
        );
        if (match) {
          await selectContext(match);
          return;
        }
      }
      setStoredWorkspace(next);
      setWorkspaceState(next);
    },
    [contexts, selectContext],
  );

  const organizations = useMemo(
    () =>
      contexts
        .filter((c) => c.type === "organization")
        .map(
          (c): OrganizationWorkspaceItem => ({
            id: c.organization_id!,
            name: c.label,
            public_id: c.organization_public_id,
            organization_number: c.organization_number ?? undefined,
            status: (c.organization_status || "pending") as OrganizationStatus,
            role: (c.member_role || "TEACHER") as OrganizationMemberRole,
          }),
        ),
    [contexts],
  );

  const activeOrganization = useMemo((): OrganizationWorkspaceItem | null => {
    if (workspace.type !== "organization") return null;
    return organizations.find((o) => o.id === workspace.id) ?? null;
  }, [organizations, workspace]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      setWorkspace,
      selectContext,
      homeForContext,
      contexts,
      organizations,
      approvedOrganizations: organizations.filter((o) => o.status === "approved"),
      pendingOrganizations: organizations.filter((o) => o.status === "pending"),
      activeOrganization,
      isIndividual: sessionUser?.session_mode !== "organization",
      organizationId: activeOrganization?.id ?? null,
      loading,
      refetch: loadContexts,
      sessionMode: (sessionUser?.session_mode ?? "individual") as SessionMode,
      contextType: sessionUser?.context_type,
      memberRole: activeOrganization?.role ?? sessionUser?.organization?.role,
    }),
    [
      workspace,
      setWorkspace,
      selectContext,
      contexts,
      organizations,
      activeOrganization,
      sessionUser,
      loading,
      loadContexts,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = (_options?: { loadOrganizations?: boolean }): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
};

export default useWorkspace;
