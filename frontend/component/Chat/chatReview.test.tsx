import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import ChatReview from "./ChatReview";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), put: (...a: unknown[]) => put(...a), delete: (...a: unknown[]) => del(...a) } }));
let query = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/chat-admin", useSearchParams: () => new URLSearchParams(query) }));
let memberRole = "OWNER";
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => ({ memberRole, activeOrganization: { name: "Sunrise School" } }) }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const chat: AdminChat = { type: "GROUP", id: "g1", label: "Class 6 A · Math", closed: false, last_activity: "2026-11-14T04:00:00Z" };
const message: ChatMessage = {
  id: "m1",
  group_id: "g1",
  parent_id: null,
  author: { id: "st1", name: "Picked", is_teacher: false },
  content: "Something rude",
  attachments: [],
  reply_to: null,
  comment_count: 0,
  last_comment_at: null,
  pinned: false,
  deleted: false,
  created_at: "2026-11-14T04:00:00Z",
};
const report: ChatReport = {
  id: "r1",
  chat_type: "GROUP",
  chat_id: "g1",
  chat_label: "Class 6 A · Math",
  message_id: "m1",
  reporter: { id: "st2", name: "Other" },
  reason: "Calling names",
  context: [
    { id: "m0", author_id: "st2", author_name: "Other", content: "Hi", files: [], created_at: "2026-11-14T03:59:00Z", reported: false },
    { id: "m1", author_id: "st1", author_name: "Picked", content: "Something rude", files: [], created_at: "2026-11-14T04:00:00Z", reported: true },
  ],
  status: "OPEN",
  resolution: null,
  resolved_by: null,
  resolved_at: null,
  created_at: "2026-11-14T04:01:00Z",
};

beforeEach(() => {
  query = "";
  memberRole = "OWNER";
  [post, put, del].forEach((fn) => fn.mockReset().mockReturnValue(ok(null)));
  get.mockImplementation((url: string) =>
    url.endsWith("/chat/admin/chats") ? ok([chat]) : url.endsWith("/chat/admin/reports") ? ok([report]) : url.endsWith("/access-log") ? ok([]) : ok(null),
  );
});
afterEach(() => cleanup());

describe("chat review (COM-04, COM-05)", () => {
  it("opens a chat only with a reason, then deletes a message, mutes its author and closes the chat", async () => {
    post.mockImplementation((url: string) => (url.endsWith("/open") ? ok({ chat, messages: [message] }) : ok(null)));
    renderApp(<ChatReview />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Open Class 6 A · Math" }))[0]);
    const ask = within(await screen.findByRole("dialog", { name: "Why are you opening Class 6 A · Math?" }));
    const open = ask.getByRole("button", { name: "Open" }) as HTMLButtonElement;
    expect(open.disabled).toBe(true);
    fireEvent.change(ask.getByLabelText("Reason"), { target: { value: "A parent complained" } });
    fireEvent.click(open);
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/chat\/admin\/chats\/GROUP\/g1\/open$/), { reason: "A parent complained" }));

    const drawer = within(await screen.findByRole("dialog", { name: "Class 6 A · Math" }));
    fireEvent.click(drawer.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/chat\/admin\/chats\/GROUP\/g1\/messages\/m1$/)));

    fireEvent.click(drawer.getByRole("switch", { name: /Closed/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/chat\/admin\/chats\/GROUP\/g1\/closed$/), { closed: true }));
  });

  it("shows a report with the messages around it, and resolves it", async () => {
    query = "tab=reports";
    renderApp(<ChatReview />);
    const list = within(await screen.findByRole("list", { name: "Reports" }));
    expect(list.getByText("Other reported: Calling names")).toBeTruthy();
    const context = within(list.getByRole("list", { name: "The message and the ones around it" }));
    expect(context.getByText("Picked: Something rude").className).toContain("text-danger");
    fireEvent.click(list.getByRole("button", { name: "Delete the message" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/chat\/admin\/reports\/r1\/resolve$/), { resolution: "DELETED" }));
  });

  it("shows the access log to the owner only", async () => {
    renderApp(<ChatReview />);
    expect(await screen.findByRole("tab", { name: "Access log" })).toBeTruthy();
    cleanup();
    memberRole = "ADMIN";
    renderApp(<ChatReview />);
    expect(await screen.findByRole("tab", { name: "Reports" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Access log" })).toBeNull();
  });
});
