import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { setPublishField, setTestAudience } from "@/lib/features/createTestSlice";
import PublishStep from "./PublishStep";

const workspace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/tests/create" }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "t1" }) }));
vi.mock("@/hooks/api/class/useGetAllClass", () => ({ default: () => ({ classList: [{ id: "c6", class_name: "Class 6" }] }) }));

const section = (id: string, name: string) => ({ id, class_id: "c6", session_id: "s1", name, shift: null, room: null, class_teacher: null, student_count: 0 });
const offering = (id: string, sectionId: string, subject: string, teacherIds: string[]) => ({
  id,
  section_id: sectionId,
  session_id: "s1",
  term_id: null,
  subject: { id: subject, name: subject, code: null },
  enrolment_mode: "SELECTED",
  is_optional: true,
  teachers: teacherIds.map((tid) => ({ id: tid, full_name: tid })),
});
vi.mock("@/lib/axios", () => ({
  default: {
    get: (url: string) =>
      Promise.resolve({
        data: {
          payload: url.endsWith("/sections")
            ? [section("sec-a", "A"), section("sec-b", "B")]
            : [offering("o-isl-a", "sec-a", "Islam Shikkha", ["t1"]), offering("o-hin-a", "sec-a", "Hindu Dharma", ["t2"]), offering("o-isl-b", "sec-b", "Islam Shikkha", [])],
        },
      }),
  },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const renderForClass = () => {
  const view = renderApp(<PublishStep />);
  view.store.dispatch(setTestAudience("selected_class"));
  view.store.dispatch(setPublishField({ field: "selectedClassId", value: "c6" }));
  return view;
};

/** A class test can go to one subject class only (P2-03, FND-19), e.g. a religion subject. */
describe("test wizard: section and subject", () => {
  it("offers a teacher the subject classes they teach, the whole class by default", async () => {
    workspace.mockReturnValue({ isIndividual: false, activeOrganization: { role: "TEACHER" } });
    const { store } = renderForClass();
    const picker = (await screen.findByLabelText(/Section and subject/)) as HTMLSelectElement;
    expect([...picker.options].map((o) => o.textContent)).toEqual(["The whole class", "Section A · Islam Shikkha"]);

    fireEvent.change(picker, { target: { value: "o-isl-a" } });
    expect(store.getState().createTest.publishState.selectedOfferingId).toBe("o-isl-a");

    // Choosing another class starts again with the whole class.
    store.dispatch(setPublishField({ field: "selectedClassId", value: "c7" }));
    expect(store.getState().createTest.publishState.selectedOfferingId).toBe("");
  });

  it("offers an owner every subject class of the class, in Bangla too", async () => {
    workspace.mockReturnValue({ isIndividual: false, activeOrganization: { role: "OWNER" } });
    const view = renderApp(<PublishStep />, { locale: "bn" });
    view.store.dispatch(setTestAudience("selected_class"));
    view.store.dispatch(setPublishField({ field: "selectedClassId", value: "c6" }));
    const picker = (await screen.findByLabelText(/সেকশন ও বিষয়/)) as HTMLSelectElement;
    expect(picker.options).toHaveLength(4);
    expect(picker.options[0].textContent).toBe("পুরো ক্লাস");
  });
});
