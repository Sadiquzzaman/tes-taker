interface SideBarList {
  category: "Platform" | "System" | "Admin" | "Organization";
  /** Message key under `nav` (messages/en.json), e.g. "teacherRequests". */
  label: Exclude<keyof (typeof import("@/messages/en.json"))["nav"], "category">;
  route: string;
  role: RoleUserType[];
  memberRoles?: OrganizationMemberRole[];
  /** Only in a teacher's own workspace, i.e. when personal teaching is on (a solo teacher's workspace, P2-01). */
  personalWorkspaceOnly?: boolean;
  /** Feature key from the plan; the item is hidden while the workspace's plan has it off (FND-07). */
  feature?: string;
  image: React.ReactNode;
  children?: SideBarList[];
}

type RoleUserType = "STUDENT" | "TEACHER" | "ADMIN" | "SUPER_ADMIN";
