import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import ResourcesPage from "./ResourcesPage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a), delete: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/resources" }));
let memberRole = "TEACHER";
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole, activeOrganization: { name: "Sunrise School" } }) }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const resource = (extra: Partial<LibraryResource> = {}): LibraryResource => ({
  id: "r1",
  type: "LINK",
  title: "Algebra video",
  description: null,
  subject: { id: "s1", name: "Math" },
  folder_id: null,
  tags: ["ch4"],
  download_allowed: true,
  archived: false,
  url: "https://www.youtube.com/watch?v=abc",
  file: null,
  shares: [{ offering_id: "o1", label: "Class 6 A · Math" }],
  created_by: { id: "t1", name: "Rina" },
  created_at: "2026-11-14T04:00:00Z",
  ...extra,
});

beforeEach(() => {
  memberRole = "TEACHER";
  [post, patch].forEach((fn) => fn.mockReset().mockReturnValue(ok(resource())));
  get.mockImplementation((url: string) =>
    url.endsWith("/resources/subject-classes")
      ? ok([{ offering_id: "o1", label: "Class 6 A · Math", subject: { id: "s1", name: "Math" } }])
      : url.endsWith("/resources/folders")
        ? ok([])
        : url.endsWith("/insights")
          ? ok({ students: 2, opened: [{ student_id: "st1", full_name: "Other", via: "Class 6 A · Math", first_opened_at: "2026-11-14T05:00:00Z", last_opened_at: "2026-11-14T05:00:00Z", opens: 2 }], not_opened: [{ student_id: "st2", full_name: "Picked", via: "Class 6 A · Math" }] })
          : url.endsWith("/resources/mine")
            ? ok([resource({ is_new: true }), resource({ id: "r2", type: "FILE", title: "Notes", url: "/files/f1/content", download_allowed: false, file: { name: "notes.pdf", mime: "application/pdf", size: 3000 } })])
            : ok([resource({ can_edit: true })]),
  );
});
afterEach(() => cleanup());

describe("resource library (RES-01, RES-03 to RES-06)", () => {
  it("adds a link shared with a subject class", async () => {
    renderApp(<ResourcesPage />);
    expect(await screen.findByText("Shared with Class 6 A · Math")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add resource" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Add a resource" }));
    fireEvent.click(drawer.getByLabelText(/A link/));
    fireEvent.change(drawer.getByLabelText(/Web address/), { target: { value: "https://drive.google.com/x" } });
    fireEvent.change(drawer.getByLabelText(/Title/), { target: { value: "Worksheet" } });
    fireEvent.click(drawer.getByLabelText("Class 6 A · Math"));
    fireEvent.click(drawer.getByLabelText(/Students may download it/));
    fireEvent.click(drawer.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.stringMatching(/\/resources$/),
        expect.objectContaining({ type: "LINK", url: "https://drive.google.com/x", title: "Worksheet", offering_ids: ["o1"], download_allowed: false }),
      ),
    );
  });

  it("shows who opened a resource and who has not, and archives it", async () => {
    renderApp(<ResourcesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/resources\/r1$/), { archived: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Who opened it" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Algebra video" }));
    expect(await drawer.findByText("1 of 2 students opened it")).toBeTruthy();
    expect(within(drawer.getByRole("list", { name: "Not opened yet" })).getByText("Picked")).toBeTruthy();
  });

  it("students see New until they open it, and view-only files say so", async () => {
    memberRole = "STUDENT";
    const tab = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    renderApp(<ResourcesPage />);
    const list = within(await screen.findByRole("list", { name: "Resources" }));
    expect(list.getByText("New")).toBeTruthy();
    expect(list.getByText("View only: your teacher asked that this isn't downloaded.")).toBeTruthy();
    fireEvent.click(list.getAllByRole("button", { name: "Open" })[0]);
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/resources\/r1\/open$/)));
    await waitFor(() => expect(tab.location.href).toBe("https://www.youtube.com/watch?v=abc"));
    expect(list.queryByText("New")).toBeNull();
  });
});
