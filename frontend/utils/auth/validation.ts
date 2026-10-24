import type { Messages } from "next-intl";

/** Which password field a message is about (changes "Password …" to "New password …"). */
type PasswordField = "password" | "newPassword";

/**
 * Translates a `validation.*` message; pass `useTranslations("validation")` from the calling hook,
 * so errors are shown in the user's language.
 */
export type ValidationTranslator = (
  key: keyof Messages["validation"],
  values?: { field: PasswordField },
) => string;

export interface LoginErrors {
  identifier?: string;
  password?: string;
}

export interface SignUpErrors {
  full_name?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  checkboxError?: string;
}

/**
 * Validates the forgot-password / login identifier (email or phone number).
 */
export const validateForgotIdentifier = (identifier: string, t: ValidationTranslator): string => {
  const value = identifier.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const bdPhoneRegex = /^01\d{9}$/;
  const isEmail = value.includes("@");
  const isPhone = /^\d+$/.test(value);

  if (!value) {
    return t("identifierRequired");
  }
  if (isPhone && value.length !== 11) {
    return t("phoneLength");
  }
  if (isPhone && !bdPhoneRegex.test(value)) {
    return t("phoneInvalidBd");
  }
  if (isEmail && !emailRegex.test(value)) {
    return t("emailInvalidShort");
  }
  if (!isEmail && !isPhone) {
    return t("identifierInvalid");
  }

  return "";
};

/**
 * Validates email-or-phone + password login.
 */
export const validateLoginForm = (loginInfo: LoginInfo, t: ValidationTranslator): LoginErrors => {
  const errors: LoginErrors = {};
  const identifierError = validateForgotIdentifier(loginInfo.identifier, t);

  if (identifierError) {
    errors.identifier = identifierError;
  } else if (!loginInfo.password) {
    errors.password = t("passwordRequired", { field: "password" });
  } else if (loginInfo.password.length < 8) {
    errors.password = t("passwordShort", { field: "password" });
  }

  return errors;
};

export interface OrganizationLoginErrors {
  organization_number?: string;
  phone?: string;
  password?: string;
}

export const validateOrganizationLoginForm = (
  info: OrganizationLoginInfo,
  t: ValidationTranslator,
): OrganizationLoginErrors => {
  const errors: OrganizationLoginErrors = {};
  const orgNumber = info.organization_number.trim();
  const phone = info.phone.trim();
  const bdPhoneRegex = /^01\d{9}$/;

  if (!orgNumber) {
    errors.organization_number = t("organizationNumberRequired");
  } else if (!/^\d{6,}$/.test(orgNumber)) {
    errors.organization_number = t("organizationNumberShort");
  }

  if (!phone) {
    errors.phone = t("phoneRequired");
  } else if (!bdPhoneRegex.test(phone)) {
    errors.phone = t("phoneInvalidBd");
  }

  if (!info.password) {
    errors.password = t("passwordRequired", { field: "password" });
  } else if (info.password.length < 8) {
    errors.password = t("passwordShort", { field: "password" });
  }

  return errors;
};

export interface ResetPasswordErrors {
  password?: string;
  confirm_password?: string;
}

export interface ChangePasswordErrors {
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
}

/**
 * Returns the first failed password complexity rule, or "" if valid.
 * Order: length → uppercase → lowercase → number → special.
 */
export const getPasswordComplexityError = (
  password: string,
  t: ValidationTranslator,
  field: PasswordField = "password",
): string => {
  if (!password) {
    return t("passwordRequired", { field });
  }
  if (password.length < 8) {
    return t("passwordShort", { field });
  }
  if (!/[A-Z]/.test(password)) {
    return t("passwordUppercase", { field });
  }
  if (!/[a-z]/.test(password)) {
    return t("passwordLowercase", { field });
  }
  if (!/[0-9]/.test(password)) {
    return t("passwordNumber", { field });
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return t("passwordSpecial", { field });
  }
  return "";
};

/**
 * Validates the new password and confirmation during a password reset.
 */
export const validateResetPassword = (
  password: string,
  confirmPassword: string,
  t: ValidationTranslator,
): ResetPasswordErrors => {
  const errors: ResetPasswordErrors = {};
  const complexity = getPasswordComplexityError(password, t);

  if (complexity) {
    errors.password = complexity;
  } else if (!confirmPassword) {
    errors.confirm_password = t("confirmPasswordRequired");
  } else if (password !== confirmPassword) {
    errors.confirm_password = t("passwordMismatch");
  }

  return errors;
};

/**
 * Validates the change-password form for a logged-in user.
 */
export const validateChangePassword = (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  t: ValidationTranslator,
): ChangePasswordErrors => {
  const errors: ChangePasswordErrors = {};
  const complexity = getPasswordComplexityError(newPassword, t, "newPassword");

  if (!currentPassword) {
    errors.current_password = t("currentPasswordRequired");
  } else if (complexity) {
    errors.new_password = complexity;
  } else if (newPassword === currentPassword) {
    errors.new_password = t("newPasswordSame");
  } else if (!confirmPassword) {
    errors.confirm_password = t("confirmNewPasswordRequired");
  } else if (newPassword !== confirmPassword) {
    errors.confirm_password = t("newPasswordMismatch");
  }

  return errors;
};

/**
 * Validates sign-up form inputs sequentially, matching original logic.
 */
export const validateSignUpForm = (signUpInfo: SignUpInfo, t: ValidationTranslator): SignUpErrors => {
  const errors: SignUpErrors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const bdPhoneRegex = /^01\d{9}$/;
  const complexity = getPasswordComplexityError(signUpInfo.password, t);

  if (!signUpInfo.full_name) {
    errors.full_name = t("fullNameRequired");
  } else if (!signUpInfo.phone) {
    errors.phone = t("phoneRequired");
  } else if (signUpInfo.phone.length !== 11 || !bdPhoneRegex.test(signUpInfo.phone)) {
    errors.phone = t("phoneInvalid");
  } else if (!signUpInfo.email) {
    errors.email = t("emailRequired");
  } else if (!emailRegex.test(signUpInfo.email)) {
    errors.email = t("emailInvalid");
  } else if (complexity) {
    errors.password = complexity;
  } else if (!signUpInfo.confirm_password) {
    errors.confirm_password = t("confirmPasswordRequired");
  } else if (signUpInfo.password !== signUpInfo.confirm_password) {
    errors.confirm_password = t("passwordMismatch");
  } else if (!signUpInfo.agreed) {
    errors.checkboxError = t("termsRequired");
  }

  return errors;
};

export interface OrganizationSignUpErrors extends SignUpErrors {
  organization_name?: string;
}

/**
 * Validates organization registration form.
 */
export const validateOrganizationSignUpForm = (
  info: OrganizationRegisterInfo,
  t: ValidationTranslator,
): OrganizationSignUpErrors => {
  const errors: OrganizationSignUpErrors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const bdPhoneRegex = /^01\d{9}$/;
  const complexity = getPasswordComplexityError(info.password, t);

  if (!info.organization_name.trim()) {
    errors.organization_name = t("organizationNameRequired");
  } else if (!info.full_name) {
    errors.full_name = t("fullNameRequired");
  } else if (!info.phone) {
    errors.phone = t("phoneRequired");
  } else if (info.phone.length !== 11 || !bdPhoneRegex.test(info.phone)) {
    errors.phone = t("phoneInvalid");
  } else if (!info.email) {
    errors.email = t("emailRequired");
  } else if (!emailRegex.test(info.email)) {
    errors.email = t("emailInvalid");
  } else if (complexity) {
    errors.password = complexity;
  } else if (!info.confirm_password) {
    errors.confirm_password = t("confirmPasswordRequired");
  } else if (info.password !== info.confirm_password) {
    errors.confirm_password = t("passwordMismatch");
  } else if (!info.agreed) {
    errors.checkboxError = t("termsRequired");
  }

  return errors;
};
