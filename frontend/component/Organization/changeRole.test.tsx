import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import ChangeRoleDrawer from "./ChangeRoleDrawer";

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/axios", () => ({
  default: { get: (...args: unknown[]) => get(...args), patch: (...args: unknown[]) => patch(...args) },
}));

const member = {
  id: "m1",
  role: "TEACHER",
  branch_id: null,
  user: { id: "u1", full_name: "Rina Akter", email: null, phone: "01700000000" },
} as unknown as OrganizationMemberItem;

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ data: { payload: [{ id: "main", name: null, is_default: true }, { id: "farmgate", name: "Farmgate", is_default: false }] } });
  patch.mockResolvedValue({ data: {} });
});
afterEach(() => cleanup());

/** P12-01: an owner makes a teacher the branch manager of one branch. */
describe("change role", () => {
  it("asks for a branch before making someone a branch manager, then saves both", async () => {
    const onChanged = vi.fn();
    renderApp(<ChangeRoleDrawer organizationId="org-1" member={member} onClose={vi.fn()} onChanged={onChanged} />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "BRANCH_MANAGER" } });
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    const branch = await within(dialog).findByLabelText("Branch");
    await waitFor(() => expect(within(branch).getByRole("option", { name: "Farmgate" })).toBeTruthy());
    expect(within(branch).getByRole("option", { name: "Main branch" })).toBeTruthy();
    fireEvent.change(branch, { target: { value: "farmgate" } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/organizations\/org-1\/members\/m1$/), { role: "BRANCH_MANAGER", branch_id: "farmgate" }),
    );
    expect(await screen.findByText("The role is now Branch manager.")).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });

  it("changes back to teacher without a branch, in Bangla", async () => {
    renderApp(<ChangeRoleDrawer organizationId="org-1" member={{ ...member, role: "BRANCH_MANAGER", branch_id: "farmgate" }} onClose={vi.fn()} onChanged={vi.fn()} />, { locale: "bn" });
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("ভূমিকা"), { target: { value: "TEACHER" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "সংরক্ষণ" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/members\/m1$/), { role: "TEACHER" }));
  });
});
