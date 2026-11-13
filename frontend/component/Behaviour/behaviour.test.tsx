import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import BehaviourPage from "./BehaviourPage";

const get = vi.fn();
const put = vi.fn();
let memberRole: string | undefined = "TEACHER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole, isIndividual: false }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/behaviour" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });

const criteria: BehaviourCriterion[] = [
  { id: "c1", name_en: "Participation", name_bn: "অংশগ্রহণ" },
  { id: "c2", name_en: "Discipline", name_bn: "শৃঙ্খলা" },
];
const subjectClasses: PaperSubjectClass[] = [
  { offering_id: "o1", session_id: "s1", section_label: "Class 6 A", subject: { id: "math", name: "Math" }, terms: [] },
  { offering_id: "o2", session_id: "s1", section_label: "Class 6 A", subject: { id: "eng", name: "English" }, terms: [] },
];
const grid = (extra: Partial<BehaviourGrid> = {}): BehaviourGrid => ({
  offering: { id: "o1", subject: { id: "math", name: "Math" }, section: { id: "sa", name: "A", class_name: "Class 6" } },
  date: "2026-11-13",
  criteria,
  rows: [
    { student: { id: "st1", full_name: "Mitu Das", roll_no: "1" }, ratings: { c1: 5 }, remark: "Asks good questions" },
    { student: { id: "st2", full_name: "Rafi Ahmed", roll_no: "2" }, ratings: {}, remark: null },
  ],
  can_edit: true,
  ...extra,
});

const answer = (gridFor: (params: Record<string, string>) => BehaviourGrid) =>
  get.mockImplementation((url: string, config?: { params?: Record<string, string> }) =>
    url.endsWith("/subject-classes") ? ok(subjectClasses) : url.endsWith("/behaviour/criteria") ? ok(criteria) : url.endsWith("/behaviour/grid") ? ok(gridFor(config?.params ?? {})) : Promise.reject(new Error(url)),
  );

beforeEach(() => {
  memberRole = "TEACHER";
  get.mockReset();
  put.mockReset();
});
afterEach(() => cleanup());

describe("behaviour ratings (PRF-04)", () => {
  it("rates the chosen subject class on a day and sends only the changed students", async () => {
    answer(() => grid());
    put.mockRejectedValueOnce({ response: { status: 400, data: { code: "RESULTS_REMARK_NEEDS_RATING" } } }).mockReturnValueOnce(ok(grid()));
    renderApp(<BehaviourPage />);
    const table = within(await screen.findByRole("table", { name: "Behaviour ratings" }));
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/behaviour\/grid$/), { params: expect.objectContaining({ offering_id: "o1" }) });
    // Teachers don't change the criteria.
    expect(screen.queryByRole("button", { name: "Criteria" })).toBeNull();
    expect(((await table.findByLabelText("Participation for Mitu Das")) as HTMLSelectElement).value).toBe("5");
    expect(screen.getByRole("button", { name: "Save ratings" }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(table.getByLabelText("Remark for Rafi Ahmed"), { target: { value: "Quiet today" } });
    fireEvent.click(screen.getByRole("button", { name: "Save ratings" }));
    expect(await screen.findByText("Give at least one rating with a remark.")).toBeTruthy();

    fireEvent.change(table.getByLabelText("Discipline for Rafi Ahmed"), { target: { value: "4" } });
    expect(screen.getByText("1 change not saved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save ratings" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1][1]).toMatchObject({ offering_id: "o1", rows: [{ student_id: "st2", ratings: { c2: 4 }, remark: "Quiet today" }] });
    expect(await screen.findByText("Ratings saved")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Subject and section"), { target: { value: "o2" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/behaviour\/grid$/), { params: expect.objectContaining({ offering_id: "o2" }) }));
  });

  it("lets owners edit the criteria in both languages, and shows Bangla names", async () => {
    memberRole = "OWNER";
    answer(() => grid());
    put.mockReturnValue(ok([...criteria, { id: "c3", name_en: "Homework habits", name_bn: "বাড়ির কাজের অভ্যাস" }]));
    renderApp(<BehaviourPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Criteria" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Behaviour criteria" }));
    expect(((await drawer.findByLabelText("Name 1 (English)")) as HTMLInputElement).value).toBe("Participation");
    fireEvent.click(drawer.getByRole("button", { name: "Add a criterion" }));
    fireEvent.change(drawer.getByLabelText("Name 3 (English)"), { target: { value: " Homework habits " } });
    fireEvent.click(drawer.getByRole("button", { name: "Save criteria" }));
    expect(await drawer.findByText("Each criterion needs a different name in English and in Bangla.")).toBeTruthy();
    fireEvent.change(drawer.getByLabelText("Name 3 (Bangla)"), { target: { value: "বাড়ির কাজের অভ্যাস" } });
    fireEvent.click(drawer.getByRole("button", { name: "Remove criterion 2" }));
    fireEvent.click(drawer.getByRole("button", { name: "Save criteria" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][1]).toEqual({
      criteria: [
        { id: "c1", name_en: "Participation", name_bn: "অংশগ্রহণ" },
        { name_en: "Homework habits", name_bn: "বাড়ির কাজের অভ্যাস" },
      ],
    });
    expect(await screen.findByText("Criteria saved")).toBeTruthy();

    cleanup();
    renderApp(<BehaviourPage />, { locale: "bn" });
    expect(await screen.findByRole("columnheader", { name: "শৃঙ্খলা" })).toBeTruthy();
    // Ratings read in Bangla digits too.
    expect(within(await screen.findByLabelText("Mitu Das-এর শৃঙ্খলা")).getByRole("option", { name: "৫" })).toBeTruthy();
  });

  it("is read-only when the session is closed", async () => {
    answer(() => grid({ can_edit: false }));
    renderApp(<BehaviourPage />);
    expect(await screen.findByText("You can see these ratings but not change them.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save ratings" })).toBeNull();
    expect(((await screen.findByLabelText("Participation for Mitu Das")) as HTMLSelectElement).disabled).toBe(true);
  });

  it("is in Results for school staff and solo teachers, never students, behind the performance feature", () => {
    const items = sidebarList.filter((entry) => entry.route === "/behaviour");
    expect(items).toHaveLength(2);
    expect(items.every((entry) => entry.feature === "performance" && entry.group === "results" && entry.role.includes("TEACHER") && !entry.role.includes("STUDENT"))).toBe(true);
  });
});
