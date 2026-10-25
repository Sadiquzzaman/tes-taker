import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import AuthHeading from "./AuthHeading";
import LoginForm from "./LoginForm";
import OtpInput from "./OtpInput";
import ResendCode from "./ResendCode";
import SignUpChoice from "./SignUpChoice";

const loginUser = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/login", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/api/useLogin", () => ({ default: () => [loginUser, null, { loading: false }] }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("login", () => {
  it("shows field errors instead of submitting an empty form", () => {
    renderApp(<LoginForm />);
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    expect(screen.getByText("Please enter your email or phone number")).toBeTruthy();
    expect(loginUser).not.toHaveBeenCalled();
  });

  it("logs in by email, lower-cased", () => {
    renderApp(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email or phone"), { target: { value: "Rina@Example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Secret123!" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    expect(loginUser).toHaveBeenCalledWith({ email: "rina@example.com", password: "Secret123!" });
  });
});

describe("signup choice", () => {
  it("offers student, teacher and organisation accounts, in Bangla too", () => {
    const onSelectStudent = vi.fn();
    renderApp(<SignUpChoice onSelectStudent={onSelectStudent} onSelectTeacher={vi.fn()} />, { locale: "bn" });
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/signup/organization");
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onSelectStudent).toHaveBeenCalled();
  });
});

describe("verification code", () => {
  it("labels every digit box", () => {
    renderApp(<OtpInput otp={["", "", "", "", "", ""]} inputsRef={{ current: [] }} onChange={vi.fn()} onKeyDown={vi.fn()} error="Wrong code" />);
    expect(screen.getByRole("group", { name: "Verification code" })).toBeTruthy();
    expect(screen.getByLabelText("Digit 1 of 6")).toBeTruthy();
    expect(screen.getByLabelText("Digit 6 of 6").getAttribute("aria-invalid")).toBe("true");
  });

  it("only offers Resend once the timer runs out", () => {
    const onResend = vi.fn();
    renderApp(<ResendCode timeLeft={90} onResend={onResend} />, { locale: "bn" });
    expect(screen.getByText(/০১:৩০/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    renderApp(<ResendCode timeLeft={0} onResend={onResend} />);
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(onResend).toHaveBeenCalled();
  });

  it("tells screen readers which step this is", () => {
    renderApp(<AuthHeading title="Verify code" step={2} steps={3} />);
    expect(screen.getByRole("img", { name: "Step 2 of 3" })).toBeTruthy();
  });
});
