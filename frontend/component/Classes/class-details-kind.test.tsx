import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import ClassDetailsComponent from "./ClassDetailsComponent";

let classData: Partial<ClassDetailsData> = {};
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/classes" }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ isIndividual: true }) }));
vi.mock("@/hooks/classes/useClassDetails", () => ({
  default: () => ({ loading: false, apiComplete: true, classData, fetch: vi.fn(), testList: [], handleShareClass: vi.fn() }),
}));
vi.mock("../Academics/ClassSections", () => ({ default: () => <p>sections panel</p> }));

afterEach(() => cleanup());

/**
 * Sections (P2-03) are for school classes and solo teachers' classes alike (coaching batches);
 * students never see the tab.
 */
describe("class details tabs", () => {
  it("shows the Sections tab to teachers of a school class", () => {
    classData = { id: "c1", class_name: "Class 9", organization_id: "school", class_kind: "ORGANIZATION", classStudents: [] };
    renderApp(<ClassDetailsComponent classId="c1" role="TEACHER" />);
    expect(screen.getByRole("tab", { name: "Sections" })).toBeTruthy();
  });

  it("shows it for a solo teacher's class too", () => {
    classData = { id: "c2", class_name: "Physics 9", organization_id: "solo-org", class_kind: "PERSONAL", classStudents: [] };
    renderApp(<ClassDetailsComponent classId="c2" role="TEACHER" />);
    expect(screen.getByRole("tab", { name: "Sections" })).toBeTruthy();
  });

  it("hides it from students", () => {
    classData = { id: "c3", class_name: "Physics 9", organization_id: "solo-org", class_kind: "PERSONAL", classStudents: [] };
    renderApp(<ClassDetailsComponent classId="c3" role="STUDENT" />);
    expect(screen.queryByRole("tab", { name: "Sections" })).toBeNull();
  });
});
