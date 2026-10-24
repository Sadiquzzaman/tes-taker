import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import AdminOrganizationsTable from "./AdminOrganizationsTable";
import AdminPaymentsTable from "./AdminPaymentsTable";
import { slugify } from "./AdminPlansManager";
import { latestTeacherRows } from "./AdminTeachersTable";
import AdminTeacherRequestsTable from "./AdminTeacherRequestsTable";
import AdminUsersTable from "./AdminUsersTable";

const get = vi.fn();
const patch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin" }));
vi.mock("@/lib/axios", () => ({
  default: { get: (...args: unknown[]) => get(...args), patch: (...args: unknown[]) => patch(...args), post: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("admin helpers", () => {
  it("makes URL-safe plan slugs", () => {
    expect(slugify("  Pro Plan (2026)! ")).toBe("pro-plan-2026");
  });

  it("keeps one row per teacher, preferring the active subscription", () => {
    const rows = latestTeacherRows([
      { id: "a", teacher_id: "t1", status: "EXPIRED" },
      { id: "b", teacher_id: "t1", status: "ACTIVE" },
      { id: "c", teacher_id: "t2", status: "EXPIRED" },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["b", "c"]);
  });
});

describe("users", () => {
  it("searches on submit and changes a role", async () => {
    get.mockResolvedValue({
      data: { payload: [{ id: "u1", full_name: "Rina", phone: null, email: null, role: "STUDENT", is_active: 1 }], meta: { total_pages: 1 } },
    });
    patch.mockResolvedValue({});
    renderApp(<AdminUsersTable />);
    const select = (await screen.findAllByLabelText("Role for Rina"))[0];
    fireEvent.change(select, { target: { value: "TEACHER" } });
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/users\/u1\/role$/), { role: "TEACHER" }));

    fireEvent.change(screen.getByLabelText("Search by name or phone"), { target: { value: "01" } });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.any(String), { params: expect.objectContaining({ search: "01", page: 1 }) }));
  });
});

describe("teacher requests", () => {
  it("asks before approving a request", async () => {
    get.mockResolvedValue({
      data: { payload: [{ id: "r1", status: "pending", created_at: "2026-10-01T00:00:00.000Z", user: { full_name: "Rina", email: null } }], meta: { total_pages: 1 } },
    });
    patch.mockResolvedValue({});
    renderApp(<AdminTeacherRequestsTable />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Approve" }))[0]);
    const dialog = await screen.findByRole("dialog", { name: "Make Rina a teacher?" });
    expect(patch).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/r1\/approve$/), {}));
  });
});

describe("organisations", () => {
  it("sends the rejection reason", async () => {
    get.mockResolvedValue({
      data: { payload: [{ id: "o1", name: "Green School", status: "pending", created_at: "2026-10-01T00:00:00.000Z" }], meta: { total_pages: 1 } },
    });
    patch.mockResolvedValue({});
    renderApp(<AdminOrganizationsTable />, { locale: "bn" });
    expect((await screen.findAllByText("অনুমোদনের অপেক্ষায়")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "বাতিল করুন" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Green School বাতিল করবেন?" });
    fireEvent.change(within(dialog).getByLabelText(/কারণ/), { target: { value: "Missing documents" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "বাতিল করুন" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/o1\/reject$/), { rejected_reason: "Missing documents" }));
  });
});

describe("payments", () => {
  it("totals completed payments only", async () => {
    get.mockResolvedValue({
      data: {
        payload: [
          { id: "p1", amount: 500, status: "COMPLETED", created_at: "2026-10-01T00:00:00.000Z" },
          { id: "p2", amount: 900, status: "PENDING", created_at: "2026-10-02T00:00:00.000Z" },
        ],
      },
    });
    renderApp(<AdminPaymentsTable />);
    expect(await screen.findByText("৳500", { selector: "p" })).toBeTruthy();
  });
});
