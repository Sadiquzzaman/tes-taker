import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/i18n/test-utils";
import { getPasswordComplexityError, validateChangePassword, validateLoginForm, validateSignUpForm } from "./validation";

const translator = (locale: "en" | "bn") =>
  createTranslator({ locale, messages: MESSAGES[locale], namespace: "validation" });

const signUp: SignUpInfo = {
  full_name: "Test Student",
  email: "student@example.test",
  agreed: true,
  phone: "01700000000",
  password: "Str0ng!pass",
  confirm_password: "Str0ng!pass",
  role: "STUDENT",
  request_teacher: false,
} as SignUpInfo;

describe("auth validation messages", () => {
  it("are shown in English", () => {
    const t = translator("en");

    expect(validateLoginForm({ identifier: "", password: "" }, t).identifier).toBe(
      "Please enter your email or phone number",
    );
    expect(validateSignUpForm({ ...signUp, phone: "0170" }, t).phone).toBe("Please enter a valid 11-digit phone number");
    expect(getPasswordComplexityError("short", t)).toBe("Password must be at least 8 characters.");
  });

  it("are shown in Bangla", () => {
    const t = translator("bn");

    expect(validateLoginForm({ identifier: "0170", password: "" }, t).identifier).toBe("ফোন নম্বর ১১ অঙ্কের হতে হবে");
    expect(validateSignUpForm({ ...signUp, agreed: false }, t).checkboxError).toBe(
      "সেবার শর্তাবলি ও গোপনীয়তা নীতি মেনে নিতে হবে",
    );
  });

  it("name the new password when changing a password", () => {
    expect(validateChangePassword("Old!pass1", "nouppercase1!", "nouppercase1!", translator("en")).new_password).toBe(
      "New password must include at least one uppercase letter.",
    );
    expect(validateChangePassword("Old!pass1", "", "", translator("bn")).new_password).toBe("নতুন পাসওয়ার্ড লিখুন");
  });

  it("accept a valid sign-up", () => {
    expect(validateSignUpForm(signUp, translator("en"))).toEqual({});
  });
});
