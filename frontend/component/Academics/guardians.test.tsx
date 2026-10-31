import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import { guardianErrors, isBdMobile, normalizeBdMobile } from "@/utils/academics/guardians";
import OrganizationSettingsCard from "../Organization/OrganizationSettingsCard";
import GuardiansDrawer from "./GuardiansDrawer";

const get = vi.fn();
const put = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => ({ session_mode: "organization" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/organization/classes" }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({
  default: () => ({ isIndividual: false, organizationId: "org-1", activeOrganization: { id: "org-1", name: "Green School", status: "approved", role: "TEACHER" } }),
}));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
// Synthetic numbers only.
const father: Guardian = { id: "g1", name: "Test Father", relation: "FATHER", phone: "01700000001", is_primary: true };
const mother: Guardian = { id: "g2", name: "Test Mother", relation: "MOTHER", phone: "01800000002", is_primary: false };
const loaded = (guardians: Guardian[], sms_locale: OrganizationLocale | null = null): StudentGuardians => ({
  guardians,
  sms_locale,
  organization_sms_locale: "bn",
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe("guardian numbers (FND-09)", () => {
  it("accepts Bangladeshi mobile numbers in the usual spellings only", () => {
    expect(normalizeBdMobile("+880 1700-000001")).toBe("01700000001");
    expect(normalizeBdMobile("1700000001")).toBe("01700000001");
    expect(isBdMobile("01700000001")).toBe(true);
    expect(isBdMobile("01200000001")).toBe(false);
    expect(isBdMobile("0170000000")).toBe(false);
  });

  it("finds a missing name, a bad number and the same number twice", () => {
    const errors = guardianErrors([
      { name: " ", relation: "FATHER", phone: "01700000001", is_primary: true },
      { name: "B", relation: "MOTHER", phone: "+8801700000001", is_primary: false },
    ]);
    expect(errors).toEqual([{ name: "nameRequired" }, { phone: "samePhone" }]);
    expect(guardianErrors([{ name: "A", relation: "OTHER", phone: "123", is_primary: true }])).toEqual([{ phone: "invalidPhone" }]);
  });
});

describe("guardians drawer (FND-09, FND-10)", () => {
  it("shows the guardians and saves a second one, the primary choice and the student's SMS language", async () => {
    get.mockImplementation(() => ok(loaded([father])));
    put.mockImplementation(() => ok(loaded([father, mother], "en")));
    renderApp(<GuardiansDrawer enrolmentId="e1" studentName="Nadia Rahman" onClose={vi.fn()} />);

    const drawer = await screen.findByRole("dialog", { name: "Guardians of Nadia Rahman" });
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/enrolments\/e1\/guardians$/));
    expect((await within(drawer).findByDisplayValue("Test Father")).getAttribute("value")).toBe("Test Father");

    fireEvent.click(within(drawer).getByRole("button", { name: "Add a guardian" }));
    const names = within(drawer).getAllByLabelText(/^Name/);
    const phones = within(drawer).getAllByLabelText(/^Mobile number/);
    fireEvent.change(names[1], { target: { value: "Test Mother" } });
    fireEvent.change(phones[1], { target: { value: "01800000002" } });
    // At most 2.
    expect(within(drawer).queryByRole("button", { name: "Add a guardian" })).toBeNull();
    fireEvent.click(within(drawer).getByRole("radio", { name: "Test Mother" }));
    fireEvent.change(within(drawer).getByLabelText(/SMS language for this student/), { target: { value: "en" } });
    expect(within(drawer).getByText("Organisation default (Bangla)")).toBeTruthy();

    fireEvent.click(within(drawer).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/enrolments\/e1\/guardians$/), {
        guardians: [
          { id: "g1", name: "Test Father", relation: "FATHER", phone: "01700000001", is_primary: false },
          { name: "Test Mother", relation: "MOTHER", phone: "01800000002", is_primary: true },
        ],
        sms_locale: "en",
      }),
    );
  });

  it("does not save a bad number, and removing the primary makes the other one primary", async () => {
    get.mockImplementation(() => ok(loaded([father, mother])));
    put.mockImplementation(() => ok(loaded([{ ...mother, is_primary: true }])));
    renderApp(<GuardiansDrawer enrolmentId="e1" studentName="Nadia Rahman" onClose={vi.fn()} />);
    const drawer = await screen.findByRole("dialog", { name: "Guardians of Nadia Rahman" });
    await within(drawer).findByDisplayValue("Test Mother");

    fireEvent.change(within(drawer).getAllByLabelText(/^Mobile number/)[1], { target: { value: "0123" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Save" }));
    expect(await within(drawer).findByText("Enter a Bangladeshi mobile number, 01XXXXXXXXX")).toBeTruthy();
    expect(put).not.toHaveBeenCalled();

    fireEvent.change(within(drawer).getAllByLabelText(/^Mobile number/)[1], { target: { value: "01800000002" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Remove guardian 1" }));
    fireEvent.click(within(drawer).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/enrolments\/e1\/guardians$/), {
        guardians: [{ id: "g2", name: "Test Mother", relation: "MOTHER", phone: "01800000002", is_primary: true }],
        sms_locale: null,
      }),
    );
  });

  it("closes when the guardians cannot be loaded (not this student's teacher)", async () => {
    get.mockRejectedValue(Object.assign(new Error("Forbidden"), { response: { status: 403, data: { message: "Forbidden" } } }));
    const onClose = vi.fn();
    renderApp(<GuardiansDrawer enrolmentId="e1" studentName="Nadia Rahman" onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("works in Bangla", async () => {
    get.mockImplementation(() => ok(loaded([father])));
    renderApp(<GuardiansDrawer enrolmentId="e1" studentName="নাদিয়া" onClose={vi.fn()} />, { locale: "bn" });
    const drawer = await screen.findByRole("dialog", { name: "নাদিয়া এর অভিভাবক" });
    expect(await within(drawer).findByText("প্রতিষ্ঠানের ডিফল্ট (বাংলা)")).toBeTruthy();
  });
});

describe("organisation guardian SMS language (FND-10)", () => {
  it("shows the credit difference and saves the language", async () => {
    get.mockImplementation(() => ok({ organization_id: "org-1", class_teacher_enabled: true, default_locale: "bn", setup_completed_at: null, sms_locale: "bn" }));
    patch.mockImplementation(() => ok({ organization_id: "org-1", class_teacher_enabled: true, default_locale: "bn", setup_completed_at: null, sms_locale: "en" }));
    renderApp(<OrganizationSettingsCard organizationId="org-1" />);
    const select = await screen.findByLabelText(/Guardian SMS language/);
    expect(screen.getByText(/160 English or 70 Bangla characters/)).toBeTruthy();
    fireEvent.change(select, { target: { value: "en" } });
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/organizations\/org-1\/settings$/), { sms_locale: "en" }));
  });
});
