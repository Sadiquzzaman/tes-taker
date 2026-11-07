import sidebarList from "@/utils/sidebarList";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import SidebarNav from "@/component/Dashboard/SidebarNav";

const orgMemberRoles: OrganizationMemberRole[] = [
  "OWNER",
  "ADMIN",
  "ASSISTANT",
  "TEACHER",
  "STUDENT",
];

const isOrgMemberRole = (value: string | undefined): value is OrganizationMemberRole =>
  Boolean(value && orgMemberRoles.includes(value as OrganizationMemberRole));

/** The sidebar links for the signed-in role, folded into groups (shown by AppShell in the sidebar and the phone menu). */
const Sidebar = async ({ activeRoute }: { activeRoute: string }) => {
  const cookieStore = await cookies();
  const t = await getTranslations();
  const role = cookieStore.get("role")?.value as RoleUserType;
  const sessionMode = (cookieStore.get("session_mode")?.value || "individual") as SessionMode;
  const memberRoleValue = cookieStore.get("member_role")?.value;
  const memberRole = isOrgMemberRole(memberRoleValue) ? memberRoleValue : undefined;
  const personalTeacher = cookieStore.get("personal_teacher")?.value === "1";

  const isOrgStudent = sessionMode === "organization" && memberRole === "STUDENT";

  const visibleCategories =
    isOrgStudent
      ? (["Platform", "System"] as const)
      : sessionMode === "organization"
        ? (["Organization", "System"] as const)
        : role === "ADMIN" || role === "SUPER_ADMIN"
          ? (["Admin", "System"] as const)
          : (["Platform", "System"] as const);

  return (
    <div className="flex flex-col gap-1 py-2">
      {visibleCategories.map((category) => {
        const items = sidebarList.filter((element) => {
          if (element.category !== category || !element.role.includes(role)) {
            return false;
          }
          if (element.personalWorkspaceOnly && sessionMode !== "organization" && !personalTeacher) {
            return false;
          }
          if (element.memberRoles) {
            return Boolean(memberRole && element.memberRoles.includes(memberRole));
          }
          return true;
        });

        if (items.length === 0) return null;

        return (
          <div key={category} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 pt-4 text-caption font-medium uppercase tracking-wide text-ink-muted">
              {t(`nav.category.${category}`)}
            </p>
            <SidebarNav items={items} activeRoute={activeRoute} />
          </div>
        );
      })}
    </div>
  );
};

export default Sidebar;
