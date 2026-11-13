import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import ChatPage from "./ChatPage";

type Handler = (...args: unknown[]) => void;
const handlers = new Map<string, Handler>();
const fakeSocket = { connect: vi.fn(), on: (event: string, handler: Handler) => handlers.set(event, handler), emit: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn() };
vi.mock("socket.io-client", () => ({ io: () => fakeSocket }));
vi.mock("@/utils/tests/proctoringSocket", () => ({ getProctoringSocketUrl: () => "http://socket.test" }));
const get = vi.fn();
const post = vi.fn();
const request = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), request: (...a: unknown[]) => request(...a), put: vi.fn(), delete: vi.fn() } }));
let query = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/chat", useSearchParams: () => new URLSearchParams(query) }));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ activeOrganization: { name: "Sunrise School" }, memberRole: "TEACHER" }) }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const summary = (extra: Partial<ChatGroupSummary>): ChatGroupSummary => ({
  id: "g1",
  offering_id: "o1",
  class_id: "c1",
  section_label: "Class 6 A",
  subject: { id: "s1", name: "Math" },
  role: "STUDENT",
  announcement_only: false,
  read_only: false,
  muted: false,
  unread: 0,
  teachers: [{ id: "t1", name: "Rina" }],
  last_message: null,
  ...extra,
});
const message = (extra: Partial<ChatMessage>): ChatMessage => ({
  id: "m1",
  group_id: "g1",
  parent_id: null,
  author: { id: "t1", name: "Rina", is_teacher: true },
  content: "Test on Sunday",
  attachments: [],
  reply_to: null,
  comment_count: 0,
  last_comment_at: null,
  pinned: false,
  deleted: false,
  created_at: "2026-11-14T04:00:00Z",
  ...extra,
});
const detail = (extra: Partial<ChatGroupDetail> = {}): ChatGroupDetail => ({ id: "g1", label: "Class 6 A · Math", class_id: "c1", role: "STUDENT", announcement_only: false, read_only: false, muted: false, teachers: [{ id: "t1", name: "Rina" }], pinned: [], ...extra });

const serve = (groups: ChatGroupSummary[], group: ChatGroupDetail, posts: ChatMessage[]) =>
  get.mockImplementation((url: string) =>
    url.endsWith("/chat/groups") ? ok(groups) : url.endsWith("/messages") ? ok(posts) : url.endsWith("/comments") ? ok([]) : ok(group),
  );

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ id: "st1", access_token: "token" }));
  handlers.clear();
  query = "";
  post.mockReset();
  post.mockReturnValue(ok(null));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("chat (COM-01, COM-03)", () => {
  it("lists the person's chats with unread counts and opens one with the review notice", async () => {
    serve([summary({ unread: 2, last_message: { author_name: "Rina", preview: "Test on Sunday", created_at: "2026-11-14T04:00:00Z" } }), summary({ id: "g2", subject: { id: "s2", name: "Religion" } })], detail(), [message({})]);
    renderApp(<ChatPage />);
    const list = within(await screen.findByRole("navigation", { name: "Your chats" }));
    expect(list.getByText("2 new")).toBeTruthy();
    expect(list.getByText("Rina: Test on Sunday")).toBeTruthy();

    fireEvent.click(list.getByText("Class 6 A · Math"));
    expect(await screen.findByText("Messages may be reviewed by Sunrise School administrators.")).toBeTruthy();
    expect(await screen.findByText("Test on Sunday", { selector: "p" })).toBeTruthy();
    expect(list.queryByText("2 new")).toBeNull();
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/chat\/groups\/g1\/read$/)));
  });

  it("sends a post and shows messages that arrive on the socket; other chats count them as unread", async () => {
    query = "group=g1";
    serve([summary({}), summary({ id: "g2", subject: { id: "s2", name: "Religion" } })], detail(), []);
    post.mockImplementation((url: string) => (url.endsWith("/messages") ? ok(message({ id: "m9", author: { id: "st1", name: "Picked", is_teacher: false }, content: "Which pages?" })) : ok(null)));
    renderApp(<ChatPage />);
    fireEvent.change(await screen.findByLabelText("New post"), { target: { value: "Which pages?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/chat\/groups\/g1\/messages$/), { content: "Which pages?", file_ids: [] }));
    expect(await screen.findByText("Which pages?", { selector: "p" })).toBeTruthy();

    act(() => handlers.get("chat:message")?.(message({ id: "m10", content: "Pages 10 to 20." })));
    expect(await screen.findByText("Pages 10 to 20.", { selector: "p" })).toBeTruthy();
    act(() => handlers.get("chat:message")?.(message({ id: "m11", group_id: "g2", content: "Religion news" })));
    expect(within(screen.getByRole("navigation", { name: "Your chats" })).getByText("1 new")).toBeTruthy();
  });

  it("in announcement mode a student comments but does not post; a teacher sees the switch", async () => {
    query = "group=g1";
    serve([summary({ announcement_only: true })], detail({ announcement_only: true }), [message({})]);
    renderApp(<ChatPage />);
    expect(await screen.findByText("Only teachers can post here. You can comment on their posts.")).toBeTruthy();
    expect(screen.queryByLabelText("New post")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Comment" }));
    expect(await screen.findByLabelText("Comment")).toBeTruthy();
    cleanup();

    serve([summary({ role: "TEACHER" })], detail({ role: "TEACHER" }), []);
    request.mockReturnValue(ok({ announcement_only: true }));
    renderApp(<ChatPage />);
    fireEvent.click(await screen.findByRole("switch", { name: /Only teachers can post/ }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "patch", data: { announcement_only: true } })));
  });

  it("says when there are no chats", async () => {
    serve([], detail(), []);
    renderApp(<ChatPage />);
    expect(await screen.findByText("No chats yet")).toBeTruthy();
  });
});
