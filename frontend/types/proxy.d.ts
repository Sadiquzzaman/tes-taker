type RoutePolicyMatch = "exact" | "prefix";

type RoutePolicy = {
  path: string;
  match: RoutePolicyMatch;
  isPublic?: boolean;
  allowedRoles?: RoleUserType[];
  allowedSessionModes?: Array<"individual" | "organization">;
  blockedSessionModes?: Array<"individual" | "organization">;
  blockedMemberRoles?: OrganizationMemberRole[];
  redirectUnauthorizedTo?: string;
  redirectAuthenticatedTo?: string;
};
