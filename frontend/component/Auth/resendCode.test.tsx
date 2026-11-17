import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import useRegister from "@/hooks/api/useRegister";
import VerifyCode from "./VerifyCode";

const post = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { post: (...args: unknown[]) => post(...args) } }));
vi.mock("axios", () => ({ default: { post: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

beforeEach(() => {
  vi.useFakeTimers();
  post.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const runOut = () => act(() => vi.advanceTimersByTime(61_000));

/** "Resend code" asks the server for a new code (issue #345), and only restarts when it was sent. */
describe("resend code", () => {
  it("asks for a new code, then restarts the timer", async () => {
    const onResend = vi.fn().mockResolvedValue(true);
    renderApp(<VerifyCode value="01700000000" onResend={onResend} />);
    runOut();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resend code" })));
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Resend code" })).toBeNull();
    expect(screen.getByText(/Resend/)).toBeTruthy();
  });

  it("keeps the Resend button when the code could not be sent", async () => {
    const onResend = vi.fn().mockResolvedValue(false);
    renderApp(<VerifyCode value="01700000000" onResend={onResend} />);
    runOut();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resend code" })));
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Resend code" })).toBeTruthy();
  });
});

/** P12-03: the teacher's Academic or IELTS choice reaches the server. */
describe("teacher sign-up request", () => {
  const info = { full_name: "A", email: "a@example.test", phone: "01700000000", password: "x", confirm_password: "x", agreed: true, role: "STUDENT" } as unknown as SignUpInfo;
  const Harness = ({ value }: { value: SignUpInfo }) => {
    const [register] = useRegister();
    return (
      <button type="button" onClick={() => void register(value)}>
        send
      </button>
    );
  };

  it("sends the workspace type for a teacher, and none for a student", async () => {
    post.mockResolvedValue({ status: 201, data: { payload: {} } });
    renderApp(<Harness value={{ ...info, request_teacher: true, workspace_type: "IELTS" }} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "send" })));
    expect(post.mock.calls[0][1]).toMatchObject({ request_teacher: true, workspace_type: "IELTS" });
    cleanup();
    renderApp(<Harness value={info} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "send" })));
    expect(post.mock.calls[1][1]).not.toHaveProperty("workspace_type");
  });
});
