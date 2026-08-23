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
    label: "Users",
    route: "/admin/users",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarAccountIconSVG width={16} />,
  },
  {
    category: "Admin",
    label: "Teacher Requests",
    route: "/admin/teacher-requests",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarClassesIconSVG width={16} />,
  },
  {
    category: "Admin",
    label: "Organizations",
    route: "/admin/organizations",
    role: ["ADMIN", "SUPER_ADMIN"],
    image: <SidebarDashboardIconSVG width={16} />,
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
    role: ["STUDENT", "TEACHER"],
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
    label: "Billing & Plans",
    route: "/billing",
    role: ["TEACHER"],
    image: <SidebarResultsIconSVG width={16} />,
  },
  {
    category: "Organization",
    label: "Overview",
    route: "/organization",
    role: ["TEACHER"],
    memberRoles: ["OWNER", "ADMIN"],
    image: <SidebarDashboardIconSVG width={16} />,
  },
  {
    category: "Organization",
    label: "Teachers",
    route: "/organization/teachers",
    role: ["TEACHER"],
    memberRoles: ["OWNER", "ADMIN"],
    image: <SidebarAccountIconSVG width={16} />,
  },
  {
    category: "Organization",
    label: "Assistants",
    route: "/organization/assistants",
    role: ["TEACHER"],
    memberRoles: ["OWNER", "ADMIN"],
    image: <SidebarHelpIconSVG width={16} />,
  },
  {
    category: "Organization",
    label: "Students",
    route: "/organization/students",
    role: ["TEACHER"],
    memberRoles: ["OWNER", "ADMIN"],
    image: <SidebarClassesIconSVG width={16} />,
  },
  {
    category: "Organization",
    label: "Classes",
    route: "/organization/classes",
    role: ["TEACHER"],
    memberRoles: ["OWNER", "ADMIN", "ASSISTANT", "TEACHER"],
    image: <SidebarClassesIconSVG width={16} />,
  },
  {
    category: "Organization",
    label: "Assignments",
    route: "/organization/assignments",
    role: ["TEACHER"],
    memberRoles: ["OWNER", "ADMIN", "ASSISTANT"],
    image: <SidebarAccountIconSVG width={16} />,
  },
  {
    category: "Organization",
    label: "Subjects",
    route: "/organization/subjects",
    role: ["TEACHER"],
    memberRoles: ["OWNER", "ADMIN", "ASSISTANT"],
    image: <SidebarGradingIconSVG width={16} />,
  },
  {
    category: "Organization",
    label: "Tests",
    route: "/tests",
    role: ["TEACHER"],
    memberRoles: ["OWNER", "ADMIN", "TEACHER"],
    image: <SidebarTestsIconSVG width={16} />,
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
