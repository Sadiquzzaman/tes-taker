const WORKSPACE_STORAGE_KEY = "active_workspace";
const LAST_WORKSPACE_PREFIX = "last_workspace:";

const isBrowser = () => typeof window !== "undefined";

export const homeForContext = (context: UserContextItem, globalRole?: string) => {
  if (context.type === "organization") {
    if (context.organization_status === "pending") {
      return "/organization/pending";
    }
    if (context.member_role === "STUDENT" || globalRole === "STUDENT") {
      return "/classes";
    }
    if (context.member_role === "TEACHER" || context.member_role === "ASSISTANT") {
      return "/organization/classes";
    }
    return "/organization";
  }
  if (context.type === "individual_teacher") {
    return "/classes";
  }
  if (globalRole === "STUDENT") {
    return "/dashboard";
  }
  return "/dashboard";
};

export const workspaceFromUser = (user: LoginResponsePayload | null): WorkspaceSelection => {
  if (user?.session_mode === "organization" && user.organization?.id) {
    return {
      type: "organization",
      id: user.organization.id,
      name: user.organization.name,
    };
  }
  if (user?.context_type === "personal_teacher") {
    return { type: "personal_teacher" };
  }
  if (user?.context_type === "individual_teacher" && user.teacher_id) {
    return {
      type: "individual_teacher",
      teacherId: user.teacher_id,
    };
  }
  return { type: "individual" };
};

export const workspaceFromContext = (context: UserContextItem): WorkspaceSelection => {
  if (context.type === "organization" && context.organization_id) {
    return {
      type: "organization",
      id: context.organization_id,
      name: context.label,
    };
  }
  if (context.type === "personal_teacher") {
    return { type: "personal_teacher" };
  }
  if (context.type === "individual_teacher" && context.teacher_id) {
    return {
      type: "individual_teacher",
      teacherId: context.teacher_id,
      name: context.label,
    };
  }
  return { type: "individual" };
};

export const findContextForWorkspace = (
  contexts: UserContextItem[],
  workspace: WorkspaceSelection,
): UserContextItem | null => {
  if (workspace.type === "organization") {
    return (
      contexts.find(
        (context) =>
          context.actionable &&
          context.type === "organization" &&
          context.organization_id === workspace.id,
      ) ?? null
    );
  }
  if (workspace.type === "personal_teacher") {
    return contexts.find((context) => context.actionable && context.type === "personal_teacher") ?? null;
  }
  if (workspace.type === "individual_teacher") {
    return (
      contexts.find(
        (context) =>
          context.actionable &&
          context.type === "individual_teacher" &&
          context.teacher_id === workspace.teacherId,
      ) ?? null
    );
  }
  return null;
};

export const getStoredWorkspace = (): WorkspaceSelection => {
  if (!isBrowser()) {
    return { type: "individual" };
  }

  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return { type: "individual" };
    }

    const parsed = JSON.parse(raw) as WorkspaceSelection;
    if (parsed?.type === "organization" && typeof parsed.id === "string" && parsed.id) {
      return { type: "organization", id: parsed.id, name: parsed.name };
    }
    if (parsed?.type === "personal_teacher") {
      return { type: "personal_teacher" };
    }
    if (
      parsed?.type === "individual_teacher" &&
      typeof (parsed as { teacherId?: string }).teacherId === "string"
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }

  return { type: "individual" };
};

export const setStoredWorkspace = (workspace: WorkspaceSelection): void => {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  window.dispatchEvent(new CustomEvent("workspace-changed", { detail: workspace }));
};

export const clearStoredWorkspace = (): void => {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("workspace-changed", { detail: { type: "individual" } }));
};

export const getLastWorkspace = (userId: string): WorkspaceSelection | null => {
  if (!isBrowser() || !userId) {
    return null;
  }

  try {
    const raw = localStorage.getItem(`${LAST_WORKSPACE_PREFIX}${userId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as WorkspaceSelection;
    if (parsed?.type === "organization" && typeof parsed.id === "string" && parsed.id) {
      return { type: "organization", id: parsed.id, name: parsed.name };
    }
    if (parsed?.type === "personal_teacher") {
      return { type: "personal_teacher" };
    }
    if (parsed?.type === "individual_teacher" && typeof parsed.teacherId === "string") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
};

export const setLastWorkspace = (userId: string, workspace: WorkspaceSelection): void => {
  if (!isBrowser() || !userId) {
    return;
  }
  localStorage.setItem(`${LAST_WORKSPACE_PREFIX}${userId}`, JSON.stringify(workspace));
};

export const getActiveOrganizationId = (): string | null => {
  const workspace = getStoredWorkspace();
  return workspace.type === "organization" ? workspace.id : null;
};
