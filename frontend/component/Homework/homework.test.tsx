import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import sidebarList from "@/utils/sidebarList";
import HomeworkDetail from "./HomeworkDetail";
import HomeworkPage from "./HomeworkPage";
import HomeworkSettingsPage from "./HomeworkSettingsPage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const put = vi.fn();
let memberRole: string | undefined = "TEACHER";
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ id: "me", role: memberRole === "STUDENT" ? "STUDENT" : "TEACHER", access_token: "token" }), clearAuthSession: vi.fn() }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole }) }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    put: (...args: unknown[]) => put(...args),
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
const uploadMedia = vi.fn();
vi.mock("@/utils/media/uploadMedia", () => ({ uploadMedia: (...args: unknown[]) => uploadMedia(...args) }));
const photosToPdf = vi.fn();
vi.mock("@/utils/homework/photosToPdf", () => ({
  isPhoto: (file: File) => file.type.startsWith("image/"),
  photosToPdf: (...args: unknown[]) => photosToPdf(...args),
}));
let canManageBilling = true;
vi.mock("@/hooks/organization/useBillingAccess", () => ({ default: () => ({ role: "TEACHER", canManageBilling }) }));

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
  my_submission: null,
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
  canManageBilling = true;
  uploadMedia.mockReset();
  photosToPdf.mockReset();
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  put.mockReset();
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

describe("handing homework in (P5-02, HW-03)", () => {
  const mine = (extra: Partial<MySubmissions> = {}): MySubmissions => ({ submissions: [], can_submit: true, blocked_by: null, submissions_left: 2, late_now: false, max_files: 5, score: null, ...extra });
  const version = (extra: Partial<SubmissionItem> = {}): SubmissionItem => ({
    id: "s1",
    version: 1,
    text_answer: null,
    submitted_at: "2026-11-08T10:00:00.000Z",
    is_late: false,
    late_minutes: null,
    status: "SUBMITTED",
    files: [{ id: "f9", name: "homework.pdf", mime: "application/pdf", size_bytes: 9000, url: "/files/f9/content" }],
    ...extra,
  });
  const grid = (extra: Partial<HomeworkGrid> = {}): HomeworkGrid => ({
    homework: { id: "h1", total_marks: 10, submission_type: "FILE", due_at: null, scores_published_at: null },
    counts: { students: 2, handed_in: 1, late: 1, missing: 0, scored: 0 },
    rows: [
      { student: { id: "u1", full_name: "Picked", roll_no: "1" }, versions: 2, latest: { id: "s2", version: 2, submitted_at: "2026-11-08T10:00:00.000Z", is_late: true, late_minutes: 15, status: "SUBMITTED" }, score: null },
      { student: { id: "u2", full_name: "Other", roll_no: "2" }, versions: 0, latest: null, score: null },
    ],
    ...extra,
  });
  const photo = (name: string) => new File(["x"], name, { type: "image/jpeg" });

  it("puts a student's photos into one PDF and hands it in", async () => {
    memberRole = "STUDENT";
    serve({ "/homework/h1": item({ status: "PUBLISHED", can_edit: false }), "/homework/h1/my-submissions": mine() });
    photosToPdf.mockResolvedValue(new File(["pdf"], "Chapter 3 exercise.pdf", { type: "application/pdf" }));
    uploadMedia.mockResolvedValue({ id: "f9", size: 9000 });
    post.mockResolvedValue({ data: { payload: mine({ submissions: [version()], submissions_left: 1 }) } });
    renderApp(<HomeworkDetail id="h1" />);
    const card = within((await screen.findByRole("heading", { name: "Your work" })).closest("section") as HTMLElement);
    const input = (await card.findByLabelText(/Photos or files/, { selector: "input" })) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [photo("p1.jpg"), photo("p2.jpg")] } });
    expect(await card.findByLabelText("Put my photos into one PDF")).toBeTruthy();
    fireEvent.click(card.getByRole("button", { name: "Hand in" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(photosToPdf).toHaveBeenCalledWith([expect.objectContaining({ name: "p1.jpg" }), expect.objectContaining({ name: "p2.jpg" })], "Chapter 3 exercise.pdf");
    expect(uploadMedia).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/\/homework\/h1\/submissions$/);
    expect(post.mock.calls[0][1]).toEqual({ file_ids: ["f9"] });
    expect(await card.findByText("Version 1")).toBeTruthy();
    expect(card.getByRole("link", { name: "homework.pdf" })).toBeTruthy();
  });

  it("asks for a typed answer, warns when late, and explains why a student cannot hand in", async () => {
    memberRole = "STUDENT";
    serve({
      "/homework/h1": item({ status: "PUBLISHED", can_edit: false, submission_type: "TEXT" }),
      "/homework/h1/my-submissions": mine({ late_now: true }),
    });
    post.mockResolvedValue({ data: { payload: mine({ can_submit: false, blocked_by: "HOMEWORK_NO_MORE_SUBMISSIONS", submissions: [version({ text_answer: "My answer", files: [], is_late: true, late_minutes: 30 })] }) } });
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByText("The due time has passed. If you hand it in now, it is marked late.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hand in" }));
    expect(await screen.findByText("Add your work before handing it in.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "My answer" } });
    fireEvent.click(screen.getByRole("button", { name: "Hand in" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/submissions$/), { file_ids: [], text_answer: "My answer" }));
    expect(await screen.findByText("You have handed this in as many times as allowed.")).toBeTruthy();
    expect(screen.getByText("Late by 30 min")).toBeTruthy();
  });

  it("tells students to hand paper homework to the teacher", async () => {
    memberRole = "STUDENT";
    serve({ "/homework/h1": item({ status: "PUBLISHED", can_edit: false, submission_type: "PAPER" }) });
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByText("This homework is done on paper. Hand it to your teacher.")).toBeTruthy();
  });

  it("shows staff who handed it in and opens a student's versions", async () => {
    serve({
      "/homework/h1": item({ status: "PUBLISHED" }),
      "/homework/h1/grid": grid(),
      "/homework/h1/submissions/s2": { ...version({ id: "s2", version: 2 }), student: { id: "u1", full_name: "Picked" }, versions: [version({ id: "s2", version: 2 }), version()] },
    });
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByText("1 of 2 handed in")).toBeTruthy();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Late by 15 min")).toBeTruthy();
    expect(table.getByText("Not handed in")).toBeTruthy();
    fireEvent.click(table.getByRole("button", { name: "Open Picked's work" }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText("Version 2")).toBeTruthy();
    expect(drawer.getByText("Version 1")).toBeTruthy();
  });

  it("marks handed-in homework in the student's list", async () => {
    memberRole = "STUDENT";
    serve({ "/homework/mine": [item({ status: "PUBLISHED", can_edit: false, my_submission: { version: 1, submitted_at: "2026-11-08T10:00:00.000Z", is_late: false, status: "SUBMITTED" } })] });
    renderApp(<HomeworkPage />);
    expect(await screen.findByText("Handed in (version 1)")).toBeTruthy();
  });
});

describe("reviewing and scoring homework (P5-03, HW-04, HW-05, HW-06)", () => {
  const score = (extra: Partial<HomeworkScore> = {}): HomeworkScore => ({
    raw_score: 9,
    penalty: 1,
    final_score: 8,
    total_marks: 10,
    percent: 80,
    grade: { grade: "A+", gpa: 5 },
    feedback: "Good work",
    ratings: { neatness: 4 },
    is_missing: false,
    scored_at: "2026-11-09T10:00:00.000Z",
    ...extra,
  });
  const latest = { id: "s2", version: 2, submitted_at: "2026-11-08T10:00:00.000Z", is_late: true, late_minutes: 15, status: "SUBMITTED" as const };
  const sub = { id: "s2", version: 2, text_answer: "My answer", submitted_at: "2026-11-08T10:00:00.000Z", is_late: true, late_minutes: 15, status: "SUBMITTED" as const, files: [] };
  const grid = (extra: Partial<HomeworkGrid> = {}): HomeworkGrid => ({
    homework: { id: "h1", total_marks: 10, submission_type: "FILE", due_at: null, scores_published_at: null },
    counts: { students: 2, handed_in: 1, late: 1, missing: 1, scored: 0 },
    rows: [
      { student: { id: "u1", full_name: "Picked", roll_no: "1" }, versions: 1, latest, score: null },
      { student: { id: "u2", full_name: "Other", roll_no: "2" }, versions: 0, latest: null, score: null },
    ],
    ...extra,
  });

  it("shows the counts, scores a student's work with feedback and a rating, and publishes the scores", async () => {
    serve({ "/homework/h1": item({ status: "PUBLISHED" }), "/homework/h1/grid": grid(), "/homework/h1/submissions/s2": { ...sub, student: { id: "u1", full_name: "Picked" }, versions: [sub] } });
    const scoredGrid = grid({ counts: { students: 2, handed_in: 1, late: 1, missing: 1, scored: 1 }, rows: [{ ...grid().rows[0], score: score() }, grid().rows[1]] });
    put.mockReturnValue(ok(scoredGrid));
    post.mockReturnValue(ok({ ...scoredGrid, homework: { ...scoredGrid.homework, scores_published_at: "2026-11-09T11:00:00.000Z" } }));
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByText("Scores are not published yet; students do not see them.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish scores" })).toBeNull();
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Open Picked's work" }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText("My answer")).toBeTruthy();
    expect(drawer.getByText("This was handed in late; the late penalty in homework settings is taken off.")).toBeTruthy();
    fireEvent.change(drawer.getByLabelText("Score"), { target: { value: "11" } });
    expect(drawer.getByText("Enter a number from 0 to 10, with at most two decimals.")).toBeTruthy();
    expect((drawer.getByRole("button", { name: "Save score" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(drawer.getByLabelText("Score"), { target: { value: "9" } });
    fireEvent.change(drawer.getByLabelText("Feedback"), { target: { value: "Good work" } });
    fireEvent.change(drawer.getByLabelText("Neatness"), { target: { value: "4" } });
    fireEvent.click(drawer.getByRole("button", { name: "Save score" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toMatch(/\/homework\/h1\/scores$/);
    expect(put.mock.calls[0][1]).toEqual({ rows: [{ student_id: "u1", raw_score: 9, feedback: "Good work", is_missing: false, ratings: { neatness: 4 } }] });
    expect((await screen.findAllByText("8/10 · 80% (A+)")).length).toBeGreaterThan(0);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    fireEvent.click(await screen.findByRole("button", { name: "Publish scores" }));
    const confirm = within(await screen.findByRole("dialog"));
    expect(confirm.getByText(/1 of 2 students are scored/)).toBeTruthy();
    fireEvent.click(confirm.getByRole("button", { name: "Publish scores" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/homework\/h1\/publish-scores$/), {}));
    expect(await screen.findByText(/Scores published/)).toBeTruthy();
  });

  it("returns the latest work for redo with a note", async () => {
    serve({ "/homework/h1": item({ status: "PUBLISHED" }), "/homework/h1/grid": grid(), "/homework/h1/submissions/s2": { ...sub, student: { id: "u1", full_name: "Picked" }, versions: [sub] } });
    post.mockReturnValue(ok(grid({ rows: [{ ...grid().rows[0], latest: { ...latest, status: "RETURNED" } }, grid().rows[1]] })));
    renderApp(<HomeworkDetail id="h1" />);
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Open Picked's work" }));
    fireEvent.click(await screen.findByRole("button", { name: "Return for redo" }));
    fireEvent.change(await screen.findByLabelText("Note for the student (optional)"), { target: { value: "Show your steps" } });
    const dialogs = await screen.findAllByRole("dialog");
    fireEvent.click(within(dialogs[dialogs.length - 1]).getByRole("button", { name: "Return for redo" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/submissions\/s2\/return$/), { note: "Show your steps" }));
    expect(await screen.findByText("Returned; the student was told.")).toBeTruthy();
  });

  it("reminds students who have not handed in, with an SMS to guardians when chosen", async () => {
    serve({ "/homework/h1": item({ status: "PUBLISHED" }), "/homework/h1/grid": grid() });
    post.mockReturnValue(ok({ students: 1, guardian_sms: 2 }));
    renderApp(<HomeworkDetail id="h1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Remind missing" }));
    const modal = within(await screen.findByRole("dialog"));
    expect(modal.getByText("1 student gets a notice in the app.")).toBeTruthy();
    fireEvent.click(modal.getByLabelText("Also send an SMS to their guardians"));
    fireEvent.click(modal.getByRole("button", { name: "Send reminder" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/homework\/h1\/remind-missing$/), { sms_guardians: true }));
    expect(await screen.findByText("Reminded 1 students; 2 SMS queued.")).toBeTruthy();
  });

  it("enters paper homework scores in a grid and saves only the changed rows", async () => {
    const paper = grid({
      homework: { id: "h1", total_marks: 10, submission_type: "PAPER", due_at: null, scores_published_at: null },
      rows: grid().rows.map((row) => ({ ...row, latest: null, versions: 0 })),
    });
    serve({ "/homework/h1": item({ status: "PUBLISHED", submission_type: "PAPER" }), "/homework/h1/grid": paper });
    put.mockReturnValue(ok(paper));
    renderApp(<HomeworkDetail id="h1" />);
    expect(screen.queryByRole("button", { name: "Remind missing" })).toBeNull();
    const save = (await screen.findByRole("button", { name: "Save all" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Score for Picked"), { target: { value: "7.5" } });
    fireEvent.change(screen.getByLabelText("Remark for Picked"), { target: { value: "Neat" } });
    fireEvent.change(screen.getByLabelText("Effort for Picked"), { target: { value: "5" } });
    const other = screen.getAllByLabelText("Not handed in")[1];
    fireEvent.click(other);
    expect(screen.getByText("2 changes not saved")).toBeTruthy();
    fireEvent.click(save);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][1]).toEqual({
      rows: [
        { student_id: "u1", raw_score: 7.5, feedback: "Neat", is_missing: false, ratings: { effort: 5 } },
        { student_id: "u2", raw_score: null, feedback: null, is_missing: true, ratings: null },
      ],
    });
  });

  it("explains the API's refusal of a score", async () => {
    const paper = grid({ homework: { id: "h1", total_marks: 10, submission_type: "PAPER", due_at: null, scores_published_at: null } });
    serve({ "/homework/h1": item({ status: "PUBLISHED", submission_type: "PAPER" }), "/homework/h1/grid": paper });
    put.mockRejectedValue({ response: { status: 400, data: { code: "HOMEWORK_SCORE_INVALID", details: { total: 10 } } } });
    renderApp(<HomeworkDetail id="h1" />);
    fireEvent.change(await screen.findByLabelText("Score for Picked"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save all" }));
    expect(await screen.findByText("A score can be at most 10.")).toBeTruthy();
  });

  it("shows a student their published score, the late penalty, feedback and ratings, in Bangla too", async () => {
    memberRole = "STUDENT";
    const mine: MySubmissions = { submissions: [sub], can_submit: false, blocked_by: "HOMEWORK_ALREADY_SCORED", submissions_left: 0, late_now: false, max_files: 5, score: score() };
    serve({ "/homework/h1": item({ status: "PUBLISHED", can_edit: false }), "/homework/h1/my-submissions": mine });
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByText("8/10 · 80% (A+)")).toBeTruthy();
    expect(screen.getByText("Scored 9; 1 taken off for handing in late.")).toBeTruthy();
    expect(screen.getByText("Good work")).toBeTruthy();
    expect(screen.getByText("Neatness: 4/5")).toBeTruthy();
    cleanup();
    renderApp(<HomeworkDetail id="h1" />, { locale: "bn" });
    expect(await screen.findByText("৮/১০ · ৮০% (A+)")).toBeTruthy();
  });

  it("shows the score of paper homework to the student", async () => {
    memberRole = "STUDENT";
    serve({
      "/homework/h1": item({ status: "PUBLISHED", can_edit: false, submission_type: "PAPER" }),
      "/homework/h1/my-submissions": { submissions: [], can_submit: false, blocked_by: "HOMEWORK_PAPER_NO_SUBMISSION", submissions_left: 0, late_now: false, max_files: 5, score: score({ penalty: 0, raw_score: 8 }) },
    });
    renderApp(<HomeworkDetail id="h1" />);
    expect(await screen.findByText("8/10 · 80% (A+)")).toBeTruthy();
  });
});

describe("homework settings", () => {
  const SETTINGS: HomeworkSettings = { late_allowed: true, late_penalty: { type: "NONE", percent: 0 }, resubmissions: 1, max_files: 5 };

  it("lets the owner change late work, the penalty, resubmissions and files per hand-in", async () => {
    serve({ "/homework/settings": SETTINGS });
    patch.mockImplementation((_url: string, body: HomeworkSettings) => ok(body));
    renderApp(<HomeworkSettingsPage />);
    fireEvent.click(await screen.findByLabelText("Accept late work"));
    fireEvent.change(screen.getByLabelText("Late penalty"), { target: { value: "PER_DAY" } });
    fireEvent.change(screen.getByLabelText("Percent"), { target: { value: "15" } });
    // Said in one plain sentence, kept up to date.
    expect(screen.getByText("Students hand in, then can change it 1 more time. Each hand-in can have up to 5 files.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Changes after handing in/), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(/Files in one hand-in/), { target: { value: "3" } });
    expect(screen.getByText("Students hand in once. Each hand-in can have up to 3 files.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][1]).toEqual({ late_allowed: false, late_penalty: { type: "PER_DAY", percent: 15 }, resubmissions: 0, max_files: 3 });
    expect(await screen.findByText("Homework settings saved.")).toBeTruthy();
  });

  it("is read-only for teachers, in Bangla too", async () => {
    canManageBilling = false;
    serve({ "/homework/settings": SETTINGS });
    renderApp(<HomeworkSettingsPage />, { locale: "bn" });
    expect(await screen.findByText("মালিক ও অ্যাডমিন এই সেটিংস বদলান।")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "সেটিংস সংরক্ষণ" })).toBeNull();
  });
});

