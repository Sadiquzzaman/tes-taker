interface SideBarList {
  category: "Platform" | "System";
  label: string;
  route: string;
  role: RoleUserType[];
  image: React.ReactNode;
  children?: SideBarList[];
}

type RoleUserType = "STUDENT" | "TEACHER";
