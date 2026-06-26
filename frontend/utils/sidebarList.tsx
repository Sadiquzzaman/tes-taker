import SidebarAccountIconSVG from "@/component/svg/SidebarAccountIconSVG";
import SidebarClassesIconSVG from "@/component/svg/SidebarClassesIconSVG";
import SidebarDashboardIconSVG from "@/component/svg/SidebarDashboardIconSVG";
import SidebarGradingIconSVG from "@/component/svg/SidebarGradingIconSVG";
import SidebarHelpIconSVG from "@/component/svg/SidebarHelpIconSVG";
import SidebarResultsIconSVG from "@/component/svg/SidebarResultsIconSVG";
import SidebarTestsIconSVG from "@/component/svg/SidebarTestsIconSVG";

const sidebarList: SideBarList[] = [
  {
    category: "Platform",
    label: "Dashboard",
    route: "/dashboard",
    role: ["TEACHER"],
    image: <SidebarDashboardIconSVG width={16} />,
  },
  {
    category: "Platform",
    label: "Classes",
    route: "/classes",
    role: ["STUDENT", "TEACHER"],
    image: <SidebarClassesIconSVG width={16} />,
  },
  {
    category: "Platform",
    label: "Tests",
    route: "/tests",
    role: ["STUDENT", "TEACHER"],
    image: <SidebarTestsIconSVG width={16} />,
  },
  {
    category: "Platform",
    label: "Grading",
    route: "/grading",
    role: ["TEACHER"],
    image: <SidebarGradingIconSVG width={16} />,
  },
  {
    category: "Platform",
    label: "Results",
    route: "/results",
    role: ["TEACHER"],
    image: <SidebarResultsIconSVG width={16} />,
    children: [],
  },
  {
    category: "System",
    label: "Account",
    route: "/account",
    role: ["STUDENT", "TEACHER"],
    image: <SidebarAccountIconSVG width={16} />,
  },
  {
    category: "System",
    label: "Help",
    route: "/help",
    role: ["STUDENT", "TEACHER"],
    image: <SidebarHelpIconSVG width={16} />,
  },
  {
    category: "Admin",
    label: "Admin",
    route: "/admin",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarDashboardIconSVG width={16} />,
  },
  {
    category: "Admin",
    label: "Plans",
    route: "/admin/plans",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarTestsIconSVG width={16} />,
  },
  {
    category: "Admin",
    label: "Super Admin",
    route: "/admin/super",
    role: ["SUPER_ADMIN"],
    image: <SidebarGradingIconSVG width={16} />,
  },
];

export default sidebarList;
