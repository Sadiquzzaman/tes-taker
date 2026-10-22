import apiClient from "@/lib/axios";
import { persistAuthSession } from "@/lib/authSession";
import {
  findContextForWorkspace,
  getLastWorkspace,
  homeForContext,
  setLastWorkspace,
  setStoredWorkspace,
  workspaceFromContext,
  workspaceFromUser,
} from "@/lib/workspace";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

const defaultHomeForPayload = (payload: LoginResponsePayload) => {
  if (payload.role === "ADMIN" || payload.role === "SUPER_ADMIN") {
    return "/admin";
  }
  if (payload.session_mode === "organization") {
    const synthetic: UserContextItem = {
      type: "organization",
      key: `org:${payload.organization?.id}`,
      label: payload.organization?.name || "Organization",
      role_label: payload.organization?.role || "TEACHER",
      organization_id: payload.organization?.id,
      member_role: payload.organization?.role,
      organization_status: payload.organization?.status,
      actionable: true,
    };
    return homeForContext(synthetic, payload.role as string);
  }
  if (payload.context_type === "individual_teacher") {
    return "/classes";
  }
  return "/dashboard";
};

const selectContextRemote = async (context: UserContextItem) => {
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
  return res.data.payload;
};

const persistSelectedContext = async (payload: LoginResponsePayload, context: UserContextItem) => {
  await persistAuthSession(payload);
  const workspace = workspaceFromContext(context);
  setStoredWorkspace(workspace);
  if (payload.id) {
    setLastWorkspace(payload.id, workspace);
  }
};

export const restoreLastWorkspace = async (
  payload: LoginResponsePayload,
): Promise<{ payload: LoginResponsePayload; href: string }> => {
  let contexts = payload.contexts ?? [];
  if (contexts.length === 0 && payload.access_token) {
    try {
      const res = await apiClient.get<{ payload: UserContextItem[] }>(`${baseUrl}/auth/contexts`);
      contexts = res.data?.payload ?? [];
    } catch {
      contexts = [];
    }
  }

  const last = payload.id ? getLastWorkspace(payload.id) : null;
  const match = last ? findContextForWorkspace(contexts, last) : null;

  if (match) {
    const alreadyActive =
      (match.type === "organization" &&
        payload.session_mode === "organization" &&
        payload.organization?.id === match.organization_id) ||
      (match.type === "personal_teacher" && payload.context_type === "personal_teacher") ||
      (match.type === "individual_teacher" &&
        payload.context_type === "individual_teacher" &&
        payload.teacher_id === match.teacher_id);

    if (alreadyActive) {
      await persistSelectedContext(payload, match);
      return { payload, href: homeForContext(match, payload.role as string) };
    }

    const selected = await selectContextRemote(match);
    await persistSelectedContext(selected, match);
    return { payload: selected, href: homeForContext(match, selected.role as string) };
  }

  const current = workspaceFromUser(payload);
  setStoredWorkspace(current);
  if (payload.id && current.type !== "individual") {
    setLastWorkspace(payload.id, current);
  }
  await persistAuthSession(payload);

  return { payload, href: defaultHomeForPayload(payload) };
};
