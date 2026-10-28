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
vi.mock("./ClassSubjectsPanel", () => ({ default: () => <p>subjects panel</p> }));

afterEach(() => cleanup());

/**
 * Since P2-01 every class has an organisation (a solo teacher's is a SOLO one), so the class's
 * kind, not the presence of an organisation, decides whether it is a school class.
 */
describe("class details by class kind", () => {
  it("shows the Subjects tab for a school class", () => {
    classData = { id: "c1", class_name: "Class 9", organization_id: "school", class_kind: "ORGANIZATION", classStudents: [] };
    renderApp(<ClassDetailsComponent classId="c1" role="TEACHER" />);
    expect(screen.getByRole("tab", { name: "Subjects" })).toBeTruthy();
  });

  it("hides it for a solo teacher's class, even though it has an organisation", () => {
    classData = { id: "c2", class_name: "Physics 9", organization_id: "solo-org", class_kind: "PERSONAL", classStudents: [] };
    renderApp(<ClassDetailsComponent classId="c2" role="TEACHER" />);
    expect(screen.queryByRole("tab", { name: "Subjects" })).toBeNull();
  });
});
