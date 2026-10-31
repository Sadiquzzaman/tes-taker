import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { studentImportTemplate, studentRowsFromCsv } from "@/utils/academics/studentImport";
import StudentImportDrawer from "./StudentImportDrawer";

const post = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ session_mode: "organization" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/organization/classes" }));
vi.mock("@/lib/axios", () => ({ default: { post: (...args: unknown[]) => post(...args) } }));
vi.mock("@/hooks/organization/useWorkspace", () => ({
  default: () => ({ isIndividual: false, organizationId: "org-1", activeOrganization: { id: "org-1", name: "Green School", status: "approved", role: "ADMIN" } }),
}));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
// Synthetic numbers only.
const CSV = [
  "Name,Phone,Email,Section,Roll No,guardian1_name,guardian1_relation,guardian1_phone,notes",
  "Nadia Rahman,01900000001,,A,1,Test Father,Father,01700000001,x",
  "",
  "Karim Uddin,0190,,Z,2,,,,",
].join("\n");

const row = (over: Partial<ImportRowResult>): ImportRowResult => ({
  row: 1,
  name: "Nadia Rahman",
  contact: "01900000001",
  section: "A",
  roll_no: "1",
  guardians: 1,
  plan: "INVITE",
  errors: [],
  warnings: [],
  ...over,
});
const summary = (over: Partial<ImportSummary> = {}): ImportSummary => ({
  session: { id: "s1", name: "2026" },
  rows: [row({}), row({ row: 2, name: "Karim Uddin", contact: "0190", section: "Z", roll_no: "2", guardians: 0, plan: null, errors: [{ code: "INVALID_PHONE" }, { code: "SECTION_NOT_FOUND" }] })],
  total: 2,
  valid: 1,
  invalid: 1,
  limit: { max: 0, current: 10, adding: 1, over: false },
  ...over,
});

const chooseFile = (drawer: HTMLElement, text: string) => {
  const input = drawer.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([text], "students.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  fireEvent.change(input, { target: { files: [file] } });
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("student CSV (FND-04)", () => {
  it("reads rows by header, in any order and spelling, skipping blank lines and unknown columns", () => {
    const parsed = studentRowsFromCsv(CSV);
    expect(parsed.missing).toBe(false);
    expect(parsed.unknownHeaders).toEqual(["notes"]);
    expect(parsed.rows).toEqual([
      { name: "Nadia Rahman", phone: "01900000001", email: "", section: "A", roll_no: "1", guardian1_name: "Test Father", guardian1_relation: "Father", guardian1_phone: "01700000001" },
      { name: "Karim Uddin", phone: "0190", email: "", section: "Z", roll_no: "2", guardian1_name: "", guardian1_relation: "", guardian1_phone: "" },
    ]);
    expect(studentRowsFromCsv("roll,section\n1,A").missing).toBe(true);
  });

  it("offers a template the parser reads back", () => {
    const parsed = studentRowsFromCsv(studentImportTemplate());
    expect(parsed).toMatchObject({ missing: false, unknownHeaders: [] });
    expect(parsed.rows[0]).toMatchObject({ section: "A", guardian2_relation: "Mother" });
  });
});

describe("student import drawer", () => {
  it("previews the file with problems per row, then imports the good rows, inviting only when ticked", async () => {
    post.mockImplementation((url: string) =>
      url.endsWith("/import/preview")
        ? ok(summary())
        : ok(summary({ rows: [row({ outcome: "INVITED" }), row({ row: 2, plan: null, outcome: "SKIPPED", errors: [{ code: "INVALID_PHONE" }] })], invitations_sent: 1 })),
    );
    const onImported = vi.fn();
    renderApp(<StudentImportDrawer classId="c1" sessionId="s1" onClose={vi.fn()} onImported={onImported} />);
    const drawer = await screen.findByRole("dialog", { name: "Import students from CSV" });
    chooseFile(drawer, CSV);

    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/classes\/c1\/students\/import\/preview$/), expect.objectContaining({ session_id: "s1" })));
    expect(post.mock.calls[0][1].rows).toHaveLength(2);
    expect(await within(drawer).findByText("2026: 1 student ready, 1 row with problems.")).toBeTruthy();
    expect(within(drawer).getAllByText("Phone is not a Bangladeshi mobile number (01XXXXXXXXX)").length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("No section with this name in this class").length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("Will be invited").length).toBeGreaterThan(0);

    fireEvent.click(within(drawer).getByLabelText(/Send invitations to students without an account/));
    fireEvent.click(within(drawer).getByRole("button", { name: "Import 1 student" }));
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(expect.stringMatching(/\/classes\/c1\/students\/import$/), expect.objectContaining({ send_invitations: true, session_id: "s1" })),
    );
    expect(await within(drawer).findByText("1 student imported, 1 skipped. 1 invitation sent.")).toBeTruthy();
    expect(onImported).toHaveBeenCalled();
  });

  it("does not import over the plan's student limit", async () => {
    post.mockImplementation(() => ok(summary({ limit: { max: 10, current: 10, adding: 1, over: true } })));
    renderApp(<StudentImportDrawer classId="c1" sessionId="s1" onClose={vi.fn()} onImported={vi.fn()} />);
    const drawer = await screen.findByRole("dialog", { name: "Import students from CSV" });
    chooseFile(drawer, CSV);
    expect(await within(drawer).findByRole("alert")).toHaveProperty("textContent", "Your plan allows 10 students. You have 10, and this file adds 1. Upgrade the plan or import fewer students.");
    expect((within(drawer).getByRole("button", { name: "Import 1 student" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains a file without the needed columns and asks the API nothing", async () => {
    renderApp(<StudentImportDrawer classId="c1" sessionId="s1" onClose={vi.fn()} onImported={vi.fn()} />);
    const drawer = await screen.findByRole("dialog", { name: "Import students from CSV" });
    chooseFile(drawer, "roll,section\n1,A");
    expect(await within(drawer).findByText(/The first line must name the columns/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("works in Bangla", async () => {
    post.mockImplementation(() => ok(summary()));
    renderApp(<StudentImportDrawer classId="c1" sessionId="s1" onClose={vi.fn()} onImported={vi.fn()} />, { locale: "bn" });
    const drawer = await screen.findByRole("dialog", { name: "CSV থেকে শিক্ষার্থী ইমপোর্ট" });
    chooseFile(drawer, CSV);
    expect((await within(drawer).findAllByText("আমন্ত্রণ যাবে")).length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("ফোন নম্বরটি বাংলাদেশি মোবাইল নম্বর নয় (01XXXXXXXXX)").length).toBeGreaterThan(0);
  });
});
