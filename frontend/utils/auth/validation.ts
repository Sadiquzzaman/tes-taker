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
 * Validates login form inputs sequentially, matching original logic.
 */
export const validateLoginForm = (loginInfo: LoginInfo): LoginErrors => {
  const errors: LoginErrors = {};
  const value = loginInfo.identifier.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const bdPhoneRegex = /^01[3-9]\d{8}$/;
  const isEmail = value.includes("@");
  const isPhone = /^\d+$/.test(value);

  if (!value) {
    errors.identifier = "Please enter email or phone number";
  } else if (isPhone && value.length !== 11) {
    errors.identifier = "Phone number must be 11 digits";
  } else if (isPhone && !bdPhoneRegex.test(value)) {
    errors.identifier = "Invalid Bangladeshi phone number";
  } else if (isEmail && !emailRegex.test(value)) {
    errors.identifier = "Invalid email address";
  } else if (!isEmail && !isPhone) {
    errors.identifier = "Enter a valid email or phone number";
  } else if (!loginInfo.password) {
    errors.password = "Please enter a password";
  } else if (loginInfo.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
};

/**
 * Validates the forgot-password identifier (email or phone number).
 */
export const validateForgotIdentifier = (identifier: string): string => {
  const value = identifier.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const bdPhoneRegex = /^01[3-9]\d{8}$/;
  const isEmail = value.includes("@");
  const isPhone = /^\d+$/.test(value);

  if (!value) {
    return "Please enter your email or phone number";
  }
  if (isPhone && value.length !== 11) {
    return "Phone number must be 11 digits";
  }
  if (isPhone && !bdPhoneRegex.test(value)) {
    return "Invalid Bangladeshi phone number";
  }
  if (isEmail && !emailRegex.test(value)) {
    return "Invalid email address";
  }
  if (!isEmail && !isPhone) {
    return "Enter a valid email or phone number";
  }

  return "";
};

export interface ResetPasswordErrors {
  password?: string;
  confirm_password?: string;
}

/**
 * Validates the new password and confirmation during a password reset.
 */
export const validateResetPassword = (password: string, confirmPassword: string): ResetPasswordErrors => {
  const errors: ResetPasswordErrors = {};

  if (!password) {
    errors.password = "Please enter a password";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (!confirmPassword) {
    errors.confirm_password = "Please confirm your password";
  } else if (password !== confirmPassword) {
    errors.confirm_password = "Password and Confirm password do not match";
  }

  return errors;
};

export interface ChangePasswordErrors {
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
}

/**
 * Validates the change-password form for a logged-in user.
 */
export const validateChangePassword = (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): ChangePasswordErrors => {
  const errors: ChangePasswordErrors = {};

  if (!currentPassword) {
    errors.current_password = "Please enter your current password";
  } else if (!newPassword) {
    errors.new_password = "Please enter a new password";
  } else if (newPassword.length < 8) {
    errors.new_password = "New password must be at least 8 characters.";
  } else if (newPassword === currentPassword) {
    errors.new_password = "New password must be different from the current password";
  } else if (!confirmPassword) {
    errors.confirm_password = "Please confirm your new password";
  } else if (newPassword !== confirmPassword) {
    errors.confirm_password = "New password and Confirm password do not match";
  }

  return errors;
};

/**
 * Validates sign-up form inputs sequentially, matching original logic.
 */
export const validateSignUpForm = (signUpInfo: SignUpInfo): SignUpErrors => {
  const errors: SignUpErrors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!signUpInfo.full_name) {
    errors.full_name = "Please enter your full name";
  } else if (!signUpInfo.phone) {
    errors.phone = "Please enter a phone number";
  } else if (signUpInfo.phone.length !== 11) {
    errors.phone = "Please enter a valid 11-digit phone number";
  } else if (signUpInfo.email && !emailRegex.test(signUpInfo.email)) {
    errors.email = "It looks like the email you entered is invalid!";
  } else if (!signUpInfo.password) {
    errors.password = "Please enter a password";
  } else if (signUpInfo.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (!signUpInfo.confirm_password) {
    errors.confirm_password = "Please confirm your password";
  } else if (signUpInfo.password !== signUpInfo.confirm_password) {
    errors.confirm_password = "Password and Confirm password do not match";
  } else if (!signUpInfo.agreed) {
    errors.checkboxError = "You must agree to the Terms of Service and Privacy Policy";
  }

  return errors;
};
