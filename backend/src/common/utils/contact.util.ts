export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('880') && digits.length === 13) {
    digits = `0${digits.slice(3)}`;
  }

  if (digits.length === 10 && digits.startsWith('1')) {
    digits = `0${digits}`;
  }

  return digits.length > 0 ? digits : null;
}

export function phonesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizePhone(left);
  const normalizedRight = normalizePhone(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function emailsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeEmail(left);
  const normalizedRight = normalizeEmail(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}
