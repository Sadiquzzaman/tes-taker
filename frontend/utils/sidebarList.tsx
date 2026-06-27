import SidebarAccountIconSVG from "@/component/svg/SidebarAccountIconSVG";
import SidebarClassesIconSVG from "@/component/svg/SidebarClassesIconSVG";
import SidebarDashboardIconSVG from "@/component/svg/SidebarDashboardIconSVG";
import SidebarGradingIconSVG from "@/component/svg/SidebarGradingIconSVG";
import SidebarHelpIconSVG from "@/component/svg/SidebarHelpIconSVG";
import SidebarResultsIconSVG from "@/component/svg/SidebarResultsIconSVG";
import SidebarTestsIconSVG from "@/component/svg/SidebarTestsIconSVG";

const sidebarList: SideBarList[] = [
  {
    category: "Admin",
    label: "Plans",
    route: "/admin/plans",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarTestsIconSVG width={16} />,
  },
  {
    category: "Admin",
    label: "Payments",
    route: "/admin/payments",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarResultsIconSVG width={16} />,
  },
  {
    category: "Admin",
    label: "Teachers",
    route: "/admin/teachers",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarClassesIconSVG width={16} />,
  },
  {
    category: "Admin",
    label: "Subjects",
    route: "/admin/subjects",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarGradingIconSVG width={16} />,
  },
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
    category: "Platform",
    label: "Billing & Plans",
    route: "/billing",
    role: ["TEACHER"],
    image: <SidebarResultsIconSVG width={16} />,
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
];

export default sidebarList;
