/**
 * The order of the menu: links of their own and folding groups appear in the order of this list,
 * a group at the place of its first item; inside a group, items follow this order too (attendance:
 * the daily pages first, then its setup pages).
 */
export const NAV_ITEM_ORDER: SideBarList["label"][] = [
  "today",
  "overview",
  "dashboard",
  "organizations",
  "teachers",
  "assistants",
  "students",
  "users",
  "teacherRequests",
  "classes",
  "sessions",
  "subjects",
  "assignments",
  "calendar",
  "routine",
  "homework",
  "gradingScale",
  "homeworkSettings",
  "tests",
  "grading",
  "marks",
  "behaviour",
  "classAttendance",
  "myAttendance",
  "leave",
  "attendanceRegister",
  "attendanceReports",
  "classSetup",
  "branches",
  "holidays",
  "attendanceSettings",
  "plans",
  "payments",
  "featureRequests",
  "billing",
  "features",
  "activityLog",
  "messageLog",
  "auditLog",
  "account",
  "help",
];

/** Where each viewer's open and closed groups are kept (this browser only). */
export const NAV_OPEN_GROUPS_KEY = "nav:open-groups";

export type NavEntry =
  | { kind: "link"; item: SideBarList }
  | { kind: "group"; group: NavGroup; items: SideBarList[] };

const position = (item: SideBarList) => {
  const index = NAV_ITEM_ORDER.indexOf(item.label);
  return index === -1 ? NAV_ITEM_ORDER.length : index;
};

/**
 * The menu as links and groups, in menu order. A group with a single item is shown as that item's
 * own link (no folding for one page).
 */
export function navEntries(items: SideBarList[]): NavEntry[] {
  const sorted = [...items].sort((a, b) => position(a) - position(b));
  const entries: NavEntry[] = [];
  for (const item of sorted) {
    if (!item.group) {
      entries.push({ kind: "link", item });
      continue;
    }
    const existing = entries.find((entry) => entry.kind === "group" && entry.group === item.group);
    if (existing && existing.kind === "group") existing.items.push(item);
    else entries.push({ kind: "group", group: item.group, items: [item] });
  }
  return entries.map((entry) => (entry.kind === "group" && entry.items.length === 1 ? { kind: "link", item: entry.items[0] } : entry));
}
