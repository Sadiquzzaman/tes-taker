import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import RegisterPage from "./RegisterPage";

const get = vi.fn();
const post = vi.fn();
const downloads: { name: string; text: string }[] = [];
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ session_mode: "organization", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));
vi.mock("@/utils/attendance/paperRegister", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/attendance/paperRegister")>();
  return { ...actual, downloadCsv: (name: string, text: string) => downloads.push({ name, text }) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/attendance-register" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const failWith = (status: number, code: string) => Promise.reject({ response: { status, data: { code, message: code } } });

const SECTIONS: PaperRegisterSection[] = [
  { id: "s8a", name: "A", class_name: "Class 8", mode: "PAPER_REGISTER" },
  { id: "s9a", name: "A", class_name: "Class 9", mode: "SELF_CHECKIN" },
];
const registerOf = (section: PaperRegisterSection, month = "2026-11"): PaperRegisterView => ({
  section: { id: section.id, name: section.name, class_name: section.class_name },
  month,
  today: "2026-11-15",
  mode: section.mode,
  can_import: section.mode === "PAPER_REGISTER",
  classes: [
    { header: "2026-11-07", date: "2026-11-07", start_time: "16:00", end_time: "17:30", slot_id: "x1" },
    { header: "2026-11-14", date: "2026-11-14", start_time: "16:00", end_time: "17:30", slot_id: "x1" },
    { header: "2026-11-21", date: "2026-11-21", start_time: "16:00", end_time: "17:30", slot_id: "x1" },
  ],
  students: [
    { id: "u1", full_name: "Rahim", roll_no: "1", marks: ["PRESENT", "ABSENT", null] },
    { id: "u2", full_name: "Karim", roll_no: "2", marks: ["LATE", null, null] },
  ],
});

const serve = () =>
  get.mockImplementation((url: string, config?: { params?: { month?: string } }) => {
    if (url.endsWith("/attendance/register/sections")) return ok(SECTIONS);
    const section = SECTIONS.find((item) => url.endsWith(`/attendance/register/sections/${item.id}`));
    if (section) return ok(registerOf(section, config?.params?.month));
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

const chooseFile = (drawer: HTMLElement, text: string) => {
  const input = drawer.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([text], "class-8-a.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  fireEvent.change(input, { target: { files: [file] } });
};

const CSV = "roll_no,name,2026-11-07,2026-11-14\n1,Rahim,P,P\n2,Karim,L,অ\n";
const preview = (extra: Partial<PaperRegisterPreview> = {}): PaperRegisterPreview => ({
  section: { id: "s8a", name: "A", class_name: "Class 8" },
  month: "2026-11",
  valid: true,
  columns: [
    { column: 3, header: "2026-11-07", date: "2026-11-07", start_time: "16:00", closed: null, marks: 2, issues: [] },
    { column: 4, header: "2026-11-14", date: "2026-11-14", start_time: "16:00", closed: null, marks: 2, issues: [] },
  ],
  rows: [
    {
      row: 2, roll_no: "1", name: "Rahim", student: { id: "u1", full_name: "Rahim", roll_no: "1" }, marks: 2, issues: [], notes: [],
      cells: [
        { column: 3, value: "P", status: "PRESENT", old_status: "PRESENT", change: "SAME", issues: [], notes: [] },
        { column: 4, value: "P", status: "PRESENT", old_status: "ABSENT", change: "CHANGE", issues: [], notes: ["SELF_CHECKIN"] },
      ],
    },
    {
      row: 3, roll_no: "2", name: "Karim", student: { id: "u2", full_name: "Karim", roll_no: "2" }, marks: 2, issues: [], notes: [],
      cells: [
        { column: 3, value: "L", status: "LATE", old_status: "LATE", change: "SAME", issues: [], notes: [] },
        { column: 4, value: "অ", status: "ABSENT", old_status: null, change: "NEW", issues: [], notes: [] },
      ],
    },
  ],
  summary: { new: 1, changed: 0, unchanged: 2, kept: 0, check_ins: 1 },
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  downloads.length = 0;
});

afterEach(cleanup);

describe("monthly register page (ATT-17, ATT-13)", () => {
  it("starts with a paper-register section and shows each student's counts for the month", async () => {
    serve();
    renderApp(<RegisterPage />);
    const table = within(await screen.findByRole("table"));
    expect(screen.getByRole("combobox", { name: "Section" })).toHaveProperty("value", "s8a");
    expect(screen.getByText("November 2026")).toBeTruthy();
    const rahim = within(table.getByText("Rahim").closest("tr") as HTMLElement);
    // Present 1, Late 0, Absent 1, Leave 0, and the 21 Nov class is still to come.
    expect(rahim.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["1", "Rahim", "1", "0", "1", "0", "0"]);
    const karim = within(table.getByText("Karim").closest("tr") as HTMLElement);
    expect(karim.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2", "Karim", "0", "1", "0", "0", "1"]);
    expect(screen.getByRole("button", { name: "Import CSV" })).toBeTruthy();
  });

  it("downloads the template and the export in the same format, and a self check-in section has no import", async () => {
    serve();
    renderApp(<RegisterPage />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Download template" }));
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(downloads.map((d) => d.name)).toEqual(["class-8-a-2026-11-template.csv", "class-8-a-2026-11-register.csv"]);
    expect(downloads[0].text.split("\n")).toEqual(["roll_no,name,2026-11-07,2026-11-14,2026-11-21", "1,Rahim,,,", "2,Karim,,,"]);
    expect(downloads[1].text.split("\n")).toEqual(["roll_no,name,2026-11-07,2026-11-14,2026-11-21", "1,Rahim,P,A,", "2,Karim,L,,"]);

    fireEvent.change(screen.getByRole("combobox", { name: "Section" }), { target: { value: "s9a" } });
    await screen.findByText(/Self check-in · 3 class days, 2 students/);
    expect(screen.queryByRole("button", { name: "Import CSV" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.stringMatching(/\/attendance\/register\/sections\/s9a$/), { params: { month: "2026-10" } }));
  });

  it("checks the file, says what changes, replaces self check-ins only when ticked, then imports and reloads", async () => {
    serve();
    post.mockImplementation((url: string) => ok(url.endsWith("/preview") ? preview() : preview({ summary: { new: 1, changed: 0, unchanged: 2, kept: 0, check_ins: 1 } })));
    renderApp(<RegisterPage />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Import CSV" }));
    const drawer = await screen.findByRole("dialog", { name: "Import the register: Class 8 A, November 2026" });
    chooseFile(drawer, CSV);

    expect(await within(drawer).findByText("Everything is right. Importing saves the marks below.")).toBeTruthy();
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/attendance\/register\/sections\/s8a\/preview$/), {
      month: "2026-11",
      header: ["roll_no", "name", "2026-11-07", "2026-11-14"],
      rows: [{ cells: ["1", "Rahim", "P", "P"] }, { cells: ["2", "Karim", "L", "অ"] }],
      file_name: "class-8-a.csv",
      overwrite_check_ins: false,
    });
    expect(within(drawer).getByText("1 new mark")).toBeTruthy();
    expect(within(drawer).getByText("2 already saved")).toBeTruthy();
    expect(within(drawer).getAllByText("2026-11-14: The student checked in themselves as Absent; the file says Present.").length).toBeGreaterThan(0);

    // Without the box ticked only the new mark is imported; ticked, the check-in too.
    expect(within(drawer).getByRole("button", { name: "Import 1 mark" })).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("checkbox", { name: /Also replace 1 self check-in/ }));
    fireEvent.click(within(drawer).getByRole("button", { name: "Import 2 marks" }));
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(expect.stringMatching(/\/attendance\/register\/sections\/s8a\/import$/), expect.objectContaining({ overwrite_check_ins: true })),
    );
    expect(await screen.findByText("Register imported: 1 new mark, 1 changed.")).toBeTruthy();
    await waitFor(() => expect(get.mock.calls.filter(([url]) => String(url).endsWith("/sections/s8a")).length).toBeGreaterThan(1));
  });

  it("shows the problems per column, line and cell, and imports nothing", async () => {
    serve();
    post.mockReturnValue(
      ok(
        preview({
          valid: false,
          columns: [
            { column: 3, header: "2026-11-09", date: "2026-11-09", start_time: null, closed: "HOLIDAY", marks: 1, issues: ["CLOSED_DAY"] },
            { column: 4, header: "notes", date: null, start_time: null, closed: null, marks: 0, issues: ["COLUMN_UNKNOWN"] },
            { column: 5, header: "2026-11-14", date: "2026-11-14", start_time: "16:00", closed: null, marks: 2, issues: [] },
          ],
          rows: [
            { row: 2, roll_no: "9", name: "Nobody", student: null, marks: 1, issues: ["STUDENT_NOT_FOUND"], notes: [], cells: [] },
            {
              row: 3, roll_no: "2", name: "Karim", student: { id: "u2", full_name: "Karim", roll_no: "2" }, marks: 1, issues: [], notes: [],
              cells: [{ column: 5, value: "X", status: null, old_status: null, change: null, issues: ["STATUS_INVALID"], notes: [] }],
            },
          ],
          summary: { new: 0, changed: 0, unchanged: 0, kept: 0, check_ins: 0 },
        }),
      ),
    );
    renderApp(<RegisterPage />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Import CSV" }));
    const drawer = await screen.findByRole("dialog");
    chooseFile(drawer, CSV);

    expect(await within(drawer).findByText(/Some lines or columns have problems/)).toBeTruthy();
    expect(within(drawer).getByText("2026-11-09: This day is a holiday.")).toBeTruthy();
    expect(within(drawer).getByText("notes: This header is not a date. Use the template's headers. (empty, ignored)")).toBeTruthy();
    expect(within(drawer).getAllByText("No student of this section has this roll number or name.").length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("2026-11-14: “X” is not a mark. Use P, L, A or Leave.").length).toBeGreaterThan(0);
    expect((within(drawer).getByRole("button", { name: "Nothing to import" }) as HTMLButtonElement).disabled).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("explains a refused import in its own words", async () => {
    serve();
    post.mockImplementation((url: string) => (url.endsWith("/preview") ? ok(preview()) : failWith(409, "ATTENDANCE_REGISTER_CHANGED")));
    renderApp(<RegisterPage />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Import CSV" }));
    const drawer = await screen.findByRole("dialog");
    chooseFile(drawer, CSV);
    fireEvent.click(await within(drawer).findByRole("button", { name: "Import 1 mark" }));
    expect(await screen.findByText("The register changed while it was imported; choose the file again.")).toBeTruthy();
  });

  it("is in Bangla, and is in the staff menus with the attendance feature", async () => {
    serve();
    renderApp(<RegisterPage />, { locale: "bn" });
    await screen.findByRole("table");
    expect(screen.getByRole("heading", { name: "মাসিক হাজিরা খাতা" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "CSV ইমপোর্ট" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "CSV এক্সপোর্ট" }));
    expect(downloads[0].text.split("\n")[1]).toBe("1,Rahim,উ,অ,");

    const items = sidebarList.filter((item) => item.route === "/attendance-register");
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.feature === "attendance")).toBe(true);
    expect(items.find((item) => item.category === "Organization")?.memberRoles).toEqual(["OWNER", "ADMIN", "ASSISTANT", "TEACHER"]);
    expect(items.find((item) => item.category === "Platform")?.personalWorkspaceOnly).toBe(true);
  });
});
