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

/**
 * Validates email-or-phone + password login.
 */
export const validateLoginForm = (loginInfo: LoginInfo): LoginErrors => {
  const errors: LoginErrors = {};
  const identifierError = validateForgotIdentifier(loginInfo.identifier);

  if (identifierError) {
    errors.identifier = identifierError;
  } else if (!loginInfo.password) {
    errors.password = "Please enter a password";
  } else if (loginInfo.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
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
): OrganizationLoginErrors => {
  const errors: OrganizationLoginErrors = {};
  const orgNumber = info.organization_number.trim();
  const phone = info.phone.trim();
  const bdPhoneRegex = /^01[3-9]\d{8}$/;

  if (!orgNumber) {
    errors.organization_number = "Please enter organization number";
  } else if (!/^\d{6,}$/.test(orgNumber)) {
    errors.organization_number = "Organization number must be at least 6 digits";
  }

  if (!phone) {
    errors.phone = "Please enter phone number";
  } else if (!bdPhoneRegex.test(phone)) {
    errors.phone = "Invalid Bangladeshi phone number";
  }

  if (!info.password) {
    errors.password = "Please enter a password";
  } else if (info.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
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
export const getPasswordComplexityError = (password: string, label = "Password"): string => {
  if (!password) {
    return `Please enter a ${label.toLowerCase()}`;
  }
  if (password.length < 8) {
    return `${label} must be at least 8 characters.`;
  }
  if (!/[A-Z]/.test(password)) {
    return `${label} must include at least one uppercase letter.`;
  }
  if (!/[a-z]/.test(password)) {
    return `${label} must include at least one lowercase letter.`;
  }
  if (!/[0-9]/.test(password)) {
    return `${label} must include at least one number.`;
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return `${label} must include at least one special character.`;
  }
  return "";
};

/**
 * Validates the new password and confirmation during a password reset.
 */
export const validateResetPassword = (password: string, confirmPassword: string): ResetPasswordErrors => {
  const errors: ResetPasswordErrors = {};
  const complexity = getPasswordComplexityError(password);

  if (complexity) {
    errors.password = complexity;
  } else if (!confirmPassword) {
    errors.confirm_password = "Please confirm your password";
  } else if (password !== confirmPassword) {
    errors.confirm_password = "Password and Confirm password do not match";
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
): ChangePasswordErrors => {
  const errors: ChangePasswordErrors = {};
  const complexity = getPasswordComplexityError(newPassword, "New password");

  if (!currentPassword) {
    errors.current_password = "Please enter your current password";
  } else if (complexity) {
    errors.new_password = complexity;
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
  const complexity = getPasswordComplexityError(signUpInfo.password);

  if (!signUpInfo.full_name) {
    errors.full_name = "Please enter your full name";
  } else if (!signUpInfo.phone) {
    errors.phone = "Please enter a phone number";
  } else if (signUpInfo.phone.length !== 11) {
    errors.phone = "Please enter a valid 11-digit phone number";
  } else if (signUpInfo.email && !emailRegex.test(signUpInfo.email)) {
    errors.email = "It looks like the email you entered is invalid!";
  } else if (complexity) {
    errors.password = complexity;
  } else if (!signUpInfo.confirm_password) {
    errors.confirm_password = "Please confirm your password";
  } else if (signUpInfo.password !== signUpInfo.confirm_password) {
    errors.confirm_password = "Password and Confirm password do not match";
  } else if (!signUpInfo.agreed) {
    errors.checkboxError = "You must agree to the Terms of Service and Privacy Policy";
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
): OrganizationSignUpErrors => {
  const errors: OrganizationSignUpErrors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const complexity = getPasswordComplexityError(info.password);

  if (!info.organization_name.trim()) {
    errors.organization_name = "Please enter your organization or school name";
  } else if (!info.full_name) {
    errors.full_name = "Please enter your full name";
  } else if (!info.phone) {
    errors.phone = "Please enter a phone number";
  } else if (info.phone.length !== 11) {
    errors.phone = "Please enter a valid 11-digit phone number";
  } else if (info.email && !emailRegex.test(info.email)) {
    errors.email = "It looks like the email you entered is invalid!";
  } else if (complexity) {
    errors.password = complexity;
  } else if (!info.confirm_password) {
    errors.confirm_password = "Please confirm your password";
  } else if (info.password !== info.confirm_password) {
    errors.confirm_password = "Password and Confirm password do not match";
  } else if (!info.agreed) {
    errors.checkboxError = "You must agree to the Terms of Service and Privacy Policy";
  }

  return errors;
};
