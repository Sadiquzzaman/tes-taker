import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import AuditLogTable, { dayBoundary } from "./AuditLogTable";
import { auditChangeList } from "./useAuditText";

const get = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/audit-log" }));
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const roleChange: AuditLogItem = {
  id: "2",
  created_at: "2026-10-30T09:15:00.000Z",
  action: "member.role_change",
  organization: { id: "org-1", name: "Green School" },
  actor: { id: "u-1", full_name: "Rina Akter" },
  entity_type: "organization_member",
  entity_id: "m-1",
  before: { role: "TEACHER" },
  after: { role: "ADMIN", user_id: "u-2", user_name: "Karim" },
  reason: null,
  ip: "203.0.113.7",
};

const futureAction: AuditLogItem = {
  id: "1",
  created_at: "2026-10-29T08:00:00.000Z",
  action: "attendance.correct",
  organization: null,
  actor: null,
  entity_type: null,
  entity_id: null,
  before: null,
  after: null,
  reason: "Late bus",
};

const page = (payload: AuditLogItem[], total_pages = 1) => ({ data: { payload, meta: { page: 1, limit: 20, total: payload.length, total_pages } } });

describe("audit log table (design §8.10)", () => {
  it("lists the platform log with translated actions, who, organisation and the change", async () => {
    get.mockResolvedValue(page([roleChange, futureAction]));
    renderApp(<AuditLogTable scope="platform" />);

    const table = await screen.findByRole("table", { name: "Audit log" });
    expect(get.mock.calls[0][0]).toMatch(/\/audit-logs\/admin$/);
    expect(get.mock.calls[0][1]).toEqual({ params: expect.objectContaining({ page: 1, limit: 20, action: undefined, organization_id: undefined }) });
    expect(within(table).getByText("Member role changed")).toBeTruthy();
    expect(within(table).getByText("Rina Akter")).toBeTruthy();
    expect(within(table).getByText("Green School")).toBeTruthy();
    expect(within(table).getByText(/Role: TEACHER → ADMIN/)).toBeTruthy();
    // An action the messages do not know yet shows its key; no actor means the system.
    expect(within(table).getByText("attendance.correct")).toBeTruthy();
    expect(within(table).getByText("System")).toBeTruthy();
    expect(within(table).getByText("Reason: Late bus")).toBeTruthy();
  });

  it("filters by area and dates from the first page", async () => {
    get.mockResolvedValue(page([roleChange], 3));
    renderApp(<AuditLogTable scope="platform" />);
    await screen.findByRole("table", { name: "Audit log" });

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.any(String), { params: expect.objectContaining({ page: 2 }) }));

    fireEvent.change(screen.getByLabelText("Area"), { target: { value: "member" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.any(String), { params: expect.objectContaining({ page: 1, action: "member." }) }));

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-30" } });
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith(expect.any(String), {
        params: expect.objectContaining({ from: dayBoundary("2026-10-01"), to: dayBoundary("2026-10-30", true) }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith(expect.any(String), { params: expect.objectContaining({ action: undefined, from: undefined, to: undefined }) }),
    );
  });

  it("opens a row with before → after and the IP, and can narrow to its organisation", async () => {
    get.mockResolvedValue(page([roleChange]));
    renderApp(<AuditLogTable scope="platform" />);
    const table = await screen.findByRole("table", { name: "Audit log" });
    fireEvent.click(within(table).getByText("Member role changed"));

    const dialog = await screen.findByRole("dialog", { name: "Member role changed" });
    expect(within(dialog).getByText("TEACHER → ADMIN")).toBeTruthy();
    expect(within(dialog).getByText("203.0.113.7")).toBeTruthy();
    expect(within(dialog).getByText("Karim")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Show only this organisation" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.any(String), { params: expect.objectContaining({ organization_id: "org-1", page: 1 }) }));
    expect(screen.getByText("Organisation: Green School")).toBeTruthy();
  });

  it("shows a workspace its own log without an organisation column or IP addresses", async () => {
    const withoutIp: AuditLogItem = { ...roleChange };
    delete withoutIp.ip;
    get.mockResolvedValue(page([withoutIp]));
    renderApp(<AuditLogTable scope="organization" />);

    const table = await screen.findByRole("table", { name: "Audit log" });
    expect(get.mock.calls[0][0]).toMatch(/\/audit-logs$/);
    expect(get.mock.calls[0][1].params.organization_id).toBeUndefined();
    expect(within(table).queryByRole("columnheader", { name: "Organisation" })).toBeNull();

    fireEvent.click(within(table).getByText("Member role changed"));
    const dialog = await screen.findByRole("dialog", { name: "Member role changed" });
    expect(within(dialog).queryByText("IP address")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Show only this organisation" })).toBeNull();
  });

  it("says when nothing matches", async () => {
    get.mockResolvedValue(page([]));
    renderApp(<AuditLogTable scope="organization" />);
    expect((await screen.findAllByText("Nothing has been recorded yet.")).length).toBeGreaterThan(0);
  });
});

describe("audit helpers", () => {
  it("lists only the fields that changed", () => {
    expect(auditChangeList({ before: { role: "TEACHER", user_id: "u" }, after: { role: "ADMIN", user_id: "u" } })).toEqual([
      { key: "role", before: "TEACHER", after: "ADMIN" },
    ]);
    expect(auditChangeList({ before: null, after: { key: "max_students", value: 40 } })).toHaveLength(2);
  });

  it("turns a day filter into the start of that day, and of the next day for 'to'", () => {
    expect(dayBoundary("")).toBeUndefined();
    expect(new Date(dayBoundary("2026-10-30") as string).getTime()).toBe(new Date("2026-10-30T00:00:00").getTime());
    expect(new Date(dayBoundary("2026-10-30", true) as string).getTime()).toBe(new Date("2026-10-31T00:00:00").getTime());
  });
});
