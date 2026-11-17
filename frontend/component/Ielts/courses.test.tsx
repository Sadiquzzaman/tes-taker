import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import IeltsCourses from "./IeltsCourses";
import MyIeltsCourses from "./MyIeltsCourses";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
let workspace = { organizationId: "org-1", memberRole: "OWNER", isIndividual: false };
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace }));

const course = (overrides: Partial<IeltsCourse>): IeltsCourse => ({
  id: "c1",
  title: "Band 7 Academic",
  branch: { id: "main", name: null, is_default: true },
  start_date: "2027-01-05",
  end_date: "2027-03-31",
  status: "RUNNING",
  modules: ["READING", "WRITING"],
  seat_limit: 20,
  students: 12,
  teachers: [
    { module: "READING", offering_id: "o1", teachers: [{ id: "t1", full_name: "Rina Akter" }] },
    { module: "WRITING", offering_id: "o2", teachers: [] },
  ],
  class_id: "class-1",
  session_id: "s1",
  section_id: "sec1",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  workspace = { organizationId: "org-1", memberRole: "OWNER", isIndividual: false };
  get.mockImplementation((url: string) => {
    if (url.endsWith("/ielts/courses")) return Promise.resolve({ data: { payload: [course({}), course({ id: "c2", title: "Writing crash course", status: "ENDED", students: 0, seat_limit: null })] } });
    if (url.endsWith("/attendance/branches")) return Promise.resolve({ data: { payload: [{ id: "main", name: null, is_default: true }, { id: "farmgate", name: "Farmgate", is_default: false }] } });
    if (url.endsWith("/assignable-teachers")) return Promise.resolve({ data: { payload: [{ user: { id: "t1", full_name: "Rina Akter", phone: null } }] } });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  post.mockResolvedValue({ data: {} });
});
afterEach(() => cleanup());

/** P12-05 (IEL-13): courses for staff, and My courses for students. */
describe("IELTS courses", () => {
  it("lists courses with dates, status, seats and teachers, and links to students and the timetable", async () => {
    renderApp(<IeltsCourses />);
    const table = await screen.findByRole("table", { name: "Courses" });
    const row = within(table).getByText("Band 7 Academic").closest("tr") as HTMLElement;
    expect(within(row).getByText("Running")).toBeTruthy();
    expect(within(row).getByText("12 of 20")).toBeTruthy();
    expect(within(row).getByText("Reading: Rina Akter · Writing: No teacher yet")).toBeTruthy();
    expect(within(row).getByRole("link", { name: "Students and timetable" }).getAttribute("href")).toBe("/classes/details/class-1");
    // Only an empty course can be removed.
    expect(within(row).queryByRole("button", { name: "Remove" })).toBeNull();
    const ended = within(table).getByText("Writing crash course").closest("tr") as HTMLElement;
    expect(within(ended).getByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("makes a course with a branch, dates, modules, a seat limit and a module teacher", async () => {
    renderApp(<IeltsCourses />);
    fireEvent.click(await screen.findByRole("button", { name: "New course" }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.change(within(drawer).getByLabelText("Course title"), { target: { value: "Speaking boost" } });
    await waitFor(() => expect(within(drawer).getByLabelText("Branch")).toBeTruthy());
    fireEvent.change(within(drawer).getByLabelText("Branch"), { target: { value: "farmgate" } });
    fireEvent.change(within(drawer).getByLabelText("Starts"), { target: { value: "2027-02-01" } });
    fireEvent.change(within(drawer).getByLabelText("Ends"), { target: { value: "2027-02-28" } });
    fireEvent.click(within(drawer).getByLabelText("Speaking"));
    fireEvent.change(within(drawer).getByLabelText("Seat limit"), { target: { value: "15" } });
    fireEvent.change(within(drawer).getByLabelText("Speaking teacher"), { target: { value: "t1" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/ielts\/courses$/), {
        title: "Speaking boost",
        start_date: "2027-02-01",
        end_date: "2027-02-28",
        modules: ["SPEAKING"],
        seat_limit: 15,
        branch_id: "farmgate",
        teachers: { SPEAKING: ["t1"] },
      }),
    );
  });

  it("lets a teacher read courses but not make them", async () => {
    workspace = { organizationId: "org-1", memberRole: "TEACHER", isIndividual: false };
    renderApp(<IeltsCourses />);
    await screen.findByRole("table", { name: "Courses" });
    expect(screen.queryByRole("button", { name: "New course" })).toBeNull();
  });

  it("shows a student their courses with their teachers, in Bangla", async () => {
    renderApp(<MyIeltsCourses />, { locale: "bn" });
    const list = await screen.findByRole("list", { name: "আমার কোর্স" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getAllByText("চলছে").length).toBeGreaterThan(0);
  });
});
