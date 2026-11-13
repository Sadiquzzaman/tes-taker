interface SideBarList {
  category: "Platform" | "System" | "Admin" | "Organization";
  /** Message key under `nav` (messages/en.json), e.g. "teacherRequests". */
  label: Exclude<keyof (typeof import("@/messages/en.json"))["nav"], "category" | "group">;
  route: string;
  role: RoleUserType[];
  memberRoles?: OrganizationMemberRole[];
  /** Only in a teacher's own workspace, i.e. when personal teaching is on (a solo teacher's workspace, P2-01). */
  personalWorkspaceOnly?: boolean;
  /** Feature key(s) from the plan; the item is hidden while the workspace's plan has none of them on (FND-07). */
  feature?: string | string[];
  /** The folding menu group the item sits in (utils/sidebarGroups.ts); none = a link of its own. */
  group?: NavGroup;
  /** Attendance setup pages, shown after a small "Setup" heading inside the Attendance group. */
  setup?: boolean;
  image: React.ReactNode;
  children?: SideBarList[];
}

type RoleUserType = "STUDENT" | "TEACHER" | "ADMIN" | "SUPER_ADMIN";

type NavGroup = "people" | "academics" | "tests" | "results" | "attendance" | "billing" | "logs" | "customers" | "plans";
