interface SideBarList {
  category: "Platform" | "System" | "Admin";
  label: string;
  route: string;
  role: RoleUserType[];
  image: React.ReactNode;
  children?: SideBarList[];
}

type RoleUserType = "STUDENT" | "TEACHER" | "ADMIN" | "SUPER_ADMIN";
