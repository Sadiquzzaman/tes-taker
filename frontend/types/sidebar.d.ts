interface SideBarList {
  category: "Platform" | "System";
  label: string;
  route: string;
  image: React.ReactNode;
  children?: SideBarList[];
}
