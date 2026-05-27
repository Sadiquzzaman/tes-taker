type RoutePolicyMatch = "exact" | "prefix";

type RoutePolicy = {
  path: string;
  match: RoutePolicyMatch;
  isPublic?: boolean;
  allowedRoles?: RoleUserType[];
  redirectAuthenticatedTo?: string;
  redirectUnauthorizedTo?: string;
};
