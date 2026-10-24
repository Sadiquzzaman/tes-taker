interface SideBarList {
  category: "Platform" | "System" | "Admin" | "Organization";
  /** Message key under `nav` (messages/en.json), e.g. "teacherRequests". */
  label: Exclude<keyof (typeof import("@/messages/en.json"))["nav"], "category">;
  route: string;
  role: RoleUserType[];
  memberRoles?: OrganizationMemberRole[];
  image: React.ReactNode;
  children?: SideBarList[];
}

type RoleUserType = "STUDENT" | "TEACHER" | "ADMIN" | "SUPER_ADMIN";
