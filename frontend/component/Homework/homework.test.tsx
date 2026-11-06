import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import HomeworkDetail from "./HomeworkDetail";
import HomeworkPage from "./HomeworkPage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
let memberRole: string | undefined = "TEACHER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));
// The real editor (TipTap) is covered by its own tests; a textarea stands in here.
vi.mock("@/component/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) => (
    <textarea aria-label="Instructions" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
  RichTextContent: ({ html }: { html: string }) => <div data-testid="instructions">{html}</div>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/homework" }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const HOUR = 60 * 60_000;

const item = (extra: Partial<HomeworkItem> = {}): HomeworkItem => ({
  id: "h1",
  title: "Chapter 3 exercise",
  instructions: { html: "<p>Do 1 to 10.</p>" },
  submission_type: "FILE",
  total_marks: 10,
  due_at: new Date(Date.now() + 3 * 24 * HOUR).toISOString(),
  publish_at: null,
  published_at: null,
  status: "DRAFT",
  session_id: "s1",
  subject: { id: "math", name: "Math" },
  targets: [{ offering_id: "o-6a-math", section_label: "Class 6 A", student_ids: null }],
  attachments: [{ id: "f1", name: "worksheet.pdf", mime: "application/pdf", size_bytes: 120_000, url: "/files/f1/content" }],
  student_count: 32,
  created_by: { id: "me", full_name: "Rina" },
  created_at: "2026-11-07T04:00:00.000Z",
  can_edit: true,
  ...extra,
});

const CHOICES = [
  { offering_id: "o-6a-math", session_id: "s1", section_label: "Class 6 A", subject: { id: "math", name: "Math" } },
  { offering_id: "o-6b-math", session_id: "s1", section_label: "Class 6 B", subject: { id: "math", name: "Math" } },
  { offering_id: "o-6a-eng", session_id: "s1", section_label: "Class 6 A", subject: { id: "eng", name: "English" } },
];

const serve = (routes: Record<string, unknown>) =>
  get.mockImplementation((url: string) => {
    const path = Object.keys(routes).find((key) => url.endsWith(key));
    return path ? ok(routes[path]) : Promise.reject(new Error(`unexpected GET ${url}`));
  });

beforeEach(() => {
  memberRole = "TEACHER";
  get.mockReset();
  post.mockReset();
  patch.mockReset();
});
afterEach(() => cleanup());

describe("homework for students (HW-02)", () => {
  it("lists homework soonest due first with how close it is, linked to each one", async () => {
    memberRole = "STUDENT";
    serve({
      "/homework/mine": [
        item({ id: "h-soon", title: "Essay", due_at: new Date(Date.now() + 5 * HOUR).toISOString(), status: "PUBLISHED", can_edit: false }),
        item({ id: "h-later", title: "Worksheet", status: "PUBLISHED", can_edit: false }),
        item({ id: "h-none", title: "Reading", due_at: null, status: "PUBLISHED", can_edit: false }),
      ],
    });
    renderApp(<HomeworkPage />);
    const links = await screen.findAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/homework/h-soon", "/homework/h-later", "/homework/h-none"]);
    expect(within(links[0]).getByText(/^Due /)).toBeTruthy();
    expect(within(links[2]).getByText("No due date")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New homework" })).toBeNull();
  });

  it("says when there is none, in Bangla", async () => {
    memberRole = "STUDENT";
    serve({ "/homework/mine": [] });
    renderApp(<HomeworkPage />, { locale: "bn" });
    expect(await screen.findByText("এখন কোনো হোমওয়ার্ক নেই")).toBeTruthy();
  });
});

describe("homework for staff (HW-01)", () => {
  it("lists the homework they manage and filters by status", async () => {
    serve({ "/homework": [item(), item({ id: "h2", title: "Essay", status: "PUBLISHED" })] });
    renderApp(<HomeworkPage />);
    const table = within(await screen.findByRole("table"));
    expect(table.getByText("Chapter 3 exercise")).toBeTruthy();
    expect(table.getByText("Draft")).toBeTruthy();
    expect(table.getByText("Published")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "CANCELLED" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.stringMatching(/\/homework$/), { params: { status: "CANCELLED" } }));
  });

  it("writes a homework for one subject's classes and publishes it", async () => {
    serve({ "/homework": [], "/homework/subject-classes": CHOICES });
    post.mockImplementation((url: string) =>
      url.endsWith("/publish") ? ok(item({ status: "PUBLISHED" })) : ok(item({ status: "DRAFT" })),
    );
    renderApp(<HomeworkPage />);
    fireEvent.click(await screen.findByRole("button", { name: "New homework" }));
    const drawer = within(await screen.findByRole("dialog"));
    fireEvent.change(drawer.getByLabelText(/Title/), { target: { value: "Chapter 3 exercise" } });
    fireEvent.click(await drawer.findByLabelText("Class 6 A · Math"));
    fireEvent.click(drawer.getByLabelText("Class 6 B · Math"));
    // One subject per homework: English is greyed out once Math is picked.
    expect((drawer.getByLabelText("Class 6 A · English") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(drawer.getByLabelText("Instructions"), { target: { value: "<p>Do 1 to 10.</p>" } });
    fireEvent.click(drawer.getByLabelText(/Typed answer/));
    fireEvent.change(drawer.getByLabelText(/Total marks/), { target: { value: "10" } });
    fireEvent.click(drawer.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[0][0]).toMatch(/\/homework$/);
    expect(post.mock.calls[0][1]).toMatchObject({
      title: "Chapter 3 exercise",
      instructions: { html: "<p>Do 1 to 10.</p>" },
      submission_type: "TEXT",
      total_marks: 10,
      offering_ids: ["o-6a-math", "o-6b-math"],
      student_ids: [],
    });
    expect(post.mock.calls[1][0]).toMatch(/\/homework\/h1\/publish$/);
    expect(await screen.findByText("Published. Its students were told in the bell.")).toBeTruthy();
  });

  it("asks for a title and a class before saving, and explains the API's refusals", async () => {
    serve({ "/homework": [], "/homework/subject-classes": CHOICES });
    post.mockRejectedValue({ response: { status: 400, data: { code: "HOMEWORK_DUE_INVALID", message: "x" } } });
    renderApp(<HomeworkPage />);
    fireEvent.click(await screen.findByRole("button", { name: "New homework" }));
    const drawer = within(await screen.findByRole("dialog"));
    fireEvent.click(drawer.getByRole("button", { name: "Save draft" }));
    expect(await drawer.findByText("Give the homework a title.")).toBeTruthy();
    fireEvent.change(drawer.getByLabelText(/Title/), { target: { value: "Essay" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save draft" }));
    expect(await drawer.findByText("Choose at least one class.")).toBeTruthy();
    fireEvent.click(await drawer.findByLabelText("Class 6 A · Math"));
    fireEvent.click(drawer.getByRole("button", { name: "Save draft" }));
    expect(await drawer.findByText("The due time must be in the future.")).toBeTruthy();
  });
});

describe("one homework", () => {
  it("shows staff its details and files, and publishes, schedules or withdraws it", async () => {
    serve({ "/homework/h1": item() });
    post.mockImplementation((url: string) => ok(item({ status: url.endsWith("/cancel") ? "CANCELLED" : "PUBLISHED", can_edit: !url.endsWith("/cancel") })));
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByRole("heading", { name: "Chapter 3 exercise" })).toBeTruthy();
    expect(screen.getByText("Class 6 A")).toBeTruthy();
    expect(screen.getByText("32")).toBeTruthy();
    expect(screen.getByTestId("instructions").textContent).toBe("<p>Do 1 to 10.</p>");
    expect(screen.getByRole("link", { name: "worksheet.pdf" }).getAttribute("href")).toMatch(/\/files\/f1\/content$/);

    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/homework\/h1\/publish$/), {}));
    expect(await screen.findByText("Published")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    const confirm = within(await screen.findByRole("dialog"));
    expect(confirm.getByText("Withdraw this homework?")).toBeTruthy();
    fireEvent.click(confirm.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(post).toHaveBeenLastCalledWith(expect.stringMatching(/\/homework\/h1\/cancel$/), {}));
  });

  it("shows a student what to do, with no staff actions", async () => {
    memberRole = "STUDENT";
    serve({ "/homework/h1": item({ status: "PUBLISHED", can_edit: false, student_count: 0 }) });
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByRole("heading", { name: "Chapter 3 exercise" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
    expect(screen.queryByText("Students")).toBeNull();
  });

  it("says when a homework is not available", async () => {
    get.mockRejectedValue({ response: { status: 404, data: { code: "HOMEWORK_NOT_FOUND" } } });
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByText("This homework is not available.")).toBeTruthy();
  });
});

describe("menu", () => {
  it("puts Homework under Academics for staff, solo teachers and students, only with the homework feature", () => {
    const items = sidebarList.filter((entry) => entry.route === "/homework");
    expect(items).toHaveLength(3);
    expect(items.every((entry) => entry.feature === "homework" && entry.group === "academics")).toBe(true);
    expect(items.find((entry) => entry.category === "Organization")?.memberRoles).toEqual(["OWNER", "ADMIN", "ASSISTANT", "TEACHER"]);
  });
});
