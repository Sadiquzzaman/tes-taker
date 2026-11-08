import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEntitlementsState } from "./useEntitlements";

const get = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));

const plan = (calendar: boolean) =>
  ({ plan: { id: "p", name: "Basic", slug: "basic" }, features: { calendar }, limits: {}, usage: { exams_used_this_month: 0, total_exams_used: 0 } }) as unknown as EntitlementsPayload;

/** The menu jumped on every load while the plan's features loaded: the last answer is remembered per workspace. */
describe("entitlements", () => {
  beforeEach(() => {
    localStorage.clear();
    get.mockReset();
  });

  it("shows the workspace's last entitlements while loading, then the server's", async () => {
    get.mockResolvedValueOnce({ data: { payload: plan(true) } });
    const first = renderHook(() => useEntitlementsState(true, "org:1"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    let answer: (value: unknown) => void = () => undefined;
    get.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const second = renderHook(() => useEntitlementsState(true, "org:1"));
    await waitFor(() => expect(second.result.current.entitlements?.features.calendar).toBe(true));
    expect(second.result.current.loading).toBe(true);
    answer({ data: { payload: plan(false) } });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.entitlements?.features.calendar).toBe(false);
  });

  it("remembers nothing for another workspace", async () => {
    localStorage.setItem("entitlements:org:1", JSON.stringify(plan(true)));
    get.mockReturnValueOnce(new Promise(() => undefined));
    const other = renderHook(() => useEntitlementsState(true, "org:2"));
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(other.result.current.entitlements).toBeNull();
    expect(other.result.current.loading).toBe(true);
  });
});
