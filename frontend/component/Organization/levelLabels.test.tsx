import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTranslations } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfileView from "@/component/Account/ProfileView";
import LevelLabelsSync from "@/component/Layout/LevelLabelsSync";
import { LEVEL_LABEL_PRESETS, LEVEL_LABELS_COOKIE, readLevelLabelsCookie, writeLevelLabelsCookie } from "@/i18n/levelLabels";
import { renderApp } from "@/i18n/test-utils";
import LevelLabelsCard from "./LevelLabelsCard";
import OrganizationSettingsCard from "./OrganizationSettingsCard";

const get = vi.fn();
const patch = vi.fn();
const refresh = vi.fn();
const workspace = vi.fn();
const storedUser = vi.fn();
vi.mock("@/lib/authSession", () => ({ getStoredUser: () => storedUser() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => "/organization",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));
vi.mock("@/hooks/organization/useWorkspace", () => ({ default: () => workspace() }));

const ok = <T,>(payload: T) => Promise.resolve({ data: { payload } });
const OWNER = {
  workspace: { type: "organization", id: "org-1" },
  isIndividual: false,
  organizationId: "org-1",
  activeOrganization: { id: "org-1", name: "Green Coaching", status: "approved", role: "OWNER" },
};
const CUSTOM = {
  preset: "CUSTOM" as const,
  class: { en: { one: "Programme", other: "Programmes" }, bn: "প্রোগ্রাম" },
  section: { en: { one: "Group", other: "Groups" }, bn: "গ্রুপ" },
};

beforeEach(() => {
  vi.clearAllMocks();
  workspace.mockReturnValue(OWNER);
  storedUser.mockReturnValue({ session_mode: "organization", access_token: "token" });
});

afterEach(() => {
  cleanup();
  document.cookie = `${LEVEL_LABELS_COOKIE}=; path=/; max-age=0`;
});

describe("level names card (FND-03)", () => {
  it("switches to Course and Batch and re-renders the app with them", async () => {
    get.mockReturnValue(ok(LEVEL_LABEL_PRESETS.CLASS_SECTION));
    patch.mockReturnValue(ok(LEVEL_LABEL_PRESETS.COURSE_BATCH));
    renderApp(<LevelLabelsCard />);

    expect(((await screen.findByLabelText("Class and Section")) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Course and Batch"));
    expect(screen.getByText("English: Course / Courses ·")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save names" }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/workspace\/level-labels$/), { preset: "COURSE_BATCH" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(readLevelLabelsCookie()).toEqual(LEVEL_LABEL_PRESETS.COURSE_BATCH);
  });

  it("asks for every custom name before saving", async () => {
    get.mockReturnValue(ok(LEVEL_LABEL_PRESETS.CLASS_SECTION));
    renderApp(<LevelLabelsCard />);

    fireEvent.click(await screen.findByLabelText("Our own words"));
    fireEvent.click(screen.getByRole("button", { name: "Save names" }));
    expect((await screen.findAllByText("Enter every name, up to 30 characters.")).length).toBe(6);
    expect(patch).not.toHaveBeenCalled();
  });

  it("saves custom names in English and Bangla", async () => {
    get.mockReturnValue(ok(LEVEL_LABEL_PRESETS.CLASS_SECTION));
    patch.mockReturnValue(ok(CUSTOM));
    renderApp(<LevelLabelsCard />);

    fireEvent.click(await screen.findByLabelText("Our own words"));
    const [classOne, sectionOne] = screen.getAllByLabelText("English, one");
    const [classOther, sectionOther] = screen.getAllByLabelText("English, more than one");
    const [classBn, sectionBn] = screen.getAllByLabelText("Bangla");
    fireEvent.change(classOne, { target: { value: "Programme" } });
    fireEvent.change(classOther, { target: { value: "Programmes" } });
    fireEvent.change(classBn, { target: { value: "প্রোগ্রাম" } });
    fireEvent.change(sectionOne, { target: { value: "Group" } });
    fireEvent.change(sectionOther, { target: { value: "Groups" } });
    fireEvent.change(sectionBn, { target: { value: "গ্রুপ" } });
    fireEvent.click(screen.getByRole("button", { name: "Save names" }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/workspace\/level-labels$/), CUSTOM));
    await waitFor(() => expect(readLevelLabelsCookie()).toEqual(CUSTOM));
  });

  it("opens with the saved custom names", async () => {
    get.mockReturnValue(ok(CUSTOM));
    renderApp(<LevelLabelsCard />);
    expect(((await screen.findByLabelText("Our own words")) as HTMLInputElement).checked).toBe(true);
    expect((screen.getAllByLabelText("English, one")[0] as HTMLInputElement).value).toBe("Programme");
  });

  it("shows screens in the organisation's words", () => {
    const SectionsHeading = () => <h2>{useTranslations("academics.sections")("add")}</h2>;
    renderApp(<SectionsHeading />, { levelLabels: LEVEL_LABEL_PRESETS.COURSE_BATCH });
    expect(screen.getByRole("heading", { name: "Add batch" })).toBeTruthy();
    cleanup();
    renderApp(<SectionsHeading />, { locale: "bn", levelLabels: CUSTOM });
    expect(screen.getByRole("heading", { name: "গ্রুপ যোগ করুন" })).toBeTruthy();
  });
});

describe("where the names are set", () => {
  const SOLO = { workspace: { type: "personal_teacher" }, isIndividual: true, organizationId: null, activeOrganization: null };
  const answer = (url: string) => {
    if (url.endsWith("/auth/profile")) return ok({ id: "u1", full_name: "Rina Akter", role: "TEACHER", email: "rina@example.test", is_verified: true });
    if (url.endsWith("/workspace/level-labels")) return ok(LEVEL_LABEL_PRESETS.CLASS_SECTION);
    if (url.endsWith("/me/entitlements")) return ok({ plan: { id: "p", name: "Free", slug: "free" }, features: {}, limits: {}, usage: {} });
    return ok([]);
  };

  it("lets a solo teacher name the levels of their own workspace on the account page", async () => {
    workspace.mockReturnValue(SOLO);
    storedUser.mockReturnValue({ session_mode: "individual", personal_teacher_enabled: true, role: "TEACHER" });
    get.mockImplementation(answer);
    renderApp(<ProfileView />);
    expect(await screen.findByText("Names for classes and sections")).toBeTruthy();
  });

  it("does not offer it to a teacher in a school", async () => {
    workspace.mockReturnValue({ ...OWNER, activeOrganization: { ...OWNER.activeOrganization, role: "TEACHER" } });
    get.mockImplementation(answer);
    renderApp(<ProfileView />);
    expect(await screen.findByText("Rina Akter", { selector: "p" })).toBeTruthy();
    expect(screen.queryByText("Names for classes and sections")).toBeNull();
  });
});

describe("organisation language (FND-18)", () => {
  it("sets the language for members who have not chosen one", async () => {
    get.mockReturnValue(ok({ organization_id: "org-1", class_teacher_enabled: true, default_locale: "bn" }));
    patch.mockReturnValue(ok({ organization_id: "org-1", class_teacher_enabled: true, default_locale: "en" }));
    renderApp(<OrganizationSettingsCard organizationId="org-1" />);

    const select = (await screen.findByLabelText("Language for members")) as HTMLSelectElement;
    expect(select.value).toBe("bn");
    fireEvent.change(select, { target: { value: "en" } });
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/organizations\/org-1\/settings$/), { default_locale: "en" }),
    );
    await waitFor(() => expect(((screen.getByLabelText("Language for members")) as HTMLSelectElement).value).toBe("en"));
  });
});

describe("level names on this device", () => {
  it("loads the workspace's names and refreshes when they changed", async () => {
    get.mockReturnValue(ok(LEVEL_LABEL_PRESETS.COURSE_BATCH));
    render(<LevelLabelsSync />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/workspace\/level-labels$/));
    expect(readLevelLabelsCookie()).toEqual(LEVEL_LABEL_PRESETS.COURSE_BATCH);
  });

  it("does not refresh when the names are the same", async () => {
    writeLevelLabelsCookie(LEVEL_LABEL_PRESETS.COURSE_BATCH);
    get.mockReturnValue(ok(LEVEL_LABEL_PRESETS.COURSE_BATCH));
    render(<LevelLabelsSync />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps the device's names when the request fails, and asks nothing when signed out", async () => {
    get.mockReturnValue(Promise.reject(new Error("403")));
    render(<LevelLabelsSync />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(refresh).not.toHaveBeenCalled();

    cleanup();
    get.mockClear();
    storedUser.mockReturnValue(null);
    render(<LevelLabelsSync />);
    expect(get).not.toHaveBeenCalled();
  });
});
