interface SideBarList {
  category: "Platform" | "System" | "Admin" | "Organization";
  label: string;
  route: string;
  role: RoleUserType[];
  memberRoles?: OrganizationMemberRole[];
  image: React.ReactNode;
  children?: SideBarList[];
}

type RoleUserType = "STUDENT" | "TEACHER" | "ADMIN" | "SUPER_ADMIN";
