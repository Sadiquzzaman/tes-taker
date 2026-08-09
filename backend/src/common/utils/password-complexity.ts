/**
 * Returns the first failed password complexity rule, or "" if valid.
 */
export const getPasswordComplexityError = (password: string, label = 'Password'): string => {
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
  return '';
};
