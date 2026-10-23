import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JoinClass from "./class/page";
import JoinTest from "./test/page";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/component/Auth/AuthLayout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

const store = (values: { session?: Record<string, unknown>; user?: Record<string, unknown> }) => {
  Object.entries(values.session ?? {}).forEach(([key, value]) => sessionStorage.setItem(key, JSON.stringify(value)));
  if (values.user) localStorage.setItem("user", JSON.stringify(values.user));
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  push.mockReset();
});

describe("Join class page", () => {
  it("explains that no join request exists when storage is empty", () => {
    render(<JoinClass />);

    expect(screen.getByText("Request unavailable")).toBeTruthy();
    expect(screen.getByText("No join request was found for this session.")).toBeTruthy();
  });

  it("shows a pending request from the stored join details", () => {
    store({
      session: {
        classJoinResponse: { class_id: "c1", status: "PENDING" },
        joinSessionInfo: { id: "c1", class_name: "Physics 9A", created_user_name: "Ms Rahman" },
      },
      user: { full_name: "Nadia" },
    });

    render(<JoinClass />);

    expect(screen.getByText("Request pending Nadia")).toBeTruthy();
    expect(screen.getByText(/Class: Physics 9A/)).toBeTruthy();
  });

  it("welcomes a student who joined and clears the join details on Continue", () => {
    store({
      session: {
        classJoinResponse: { class_id: "c1", status: "JOINED" },
        joinSessionInfo: { id: "c1", class_name: "Physics 9A", created_user_name: "Ms Rahman" },
      },
      user: { full_name: "Nadia" },
    });

    render(<JoinClass />);
    expect(screen.getByText("Welcome Nadia")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(sessionStorage.getItem("classJoinResponse")).toBeNull();
    expect(sessionStorage.getItem("joinSessionInfo")).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("reports stored details it cannot read", () => {
    sessionStorage.setItem("classJoinResponse", "{not json");
    store({ session: { joinSessionInfo: { id: "c1" } }, user: { full_name: "Nadia" } });

    render(<JoinClass />);

    expect(screen.getByText("Stored join information could not be read.")).toBeTruthy();
  });
});

describe("Join test page", () => {
  const joinInfo = { id: "t1", test_name: "Algebra quiz", created_user_name: "Mr Karim", duration_minutes: 30 };

  it("welcomes an eligible student and starts the test with its id", () => {
    store({ session: { testJoinResponse: { eligible: true }, joinSessionInfo: joinInfo }, user: { full_name: "Nadia" } });

    render(<JoinTest />);
    expect(screen.getByText("Welcome Nadia")).toBeTruthy();
    expect(screen.getByText("Algebra quiz")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start Test" }));

    expect(sessionStorage.getItem("testId")).toBe("t1");
    expect(sessionStorage.getItem("joinSessionInfo")).toBeNull();
    expect(push).toHaveBeenCalledWith("/test/permissions");
  });

  it("tells a student who is not eligible", () => {
    store({ session: { testJoinResponse: { eligible: false }, joinSessionInfo: joinInfo }, user: { full_name: "Nadia" } });

    render(<JoinTest />);

    expect(screen.getByText("Not Eligible")).toBeTruthy();
    expect(screen.getByText("You are not eligible to join this test.")).toBeTruthy();
  });
});
