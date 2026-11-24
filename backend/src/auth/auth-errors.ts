/**
 * Error codes of sign-up, verification, password reset and sign-in (mobile-api issue #345). The
 * apps show their own Bangla or English text for each; `message` stays English for logs.
 */
export const AUTH_ERRORS = {
  PHONE_ALREADY_REGISTERED: 'PHONE_ALREADY_REGISTERED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  PHONE_ALREADY_VERIFIED: 'PHONE_ALREADY_VERIFIED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  /** Too many wrong codes: locked for 15 minutes (429; design §8.2). */
  OTP_LOCKED: 'OTP_LOCKED',
  /** The code could not be sent (the SMS limit of 3 an hour, or the provider failed). */
  OTP_SEND_FAILED: 'OTP_SEND_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** The phone has not been verified with its code yet: the app can offer to verify. */
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  /** Account deletion (mobile-api #358): the password given is not the account's. */
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  /** Account deletion: the user owns an organisation, which must get another owner or be closed first (409). */
  OWNER_MUST_TRANSFER: 'OWNER_MUST_TRANSFER',
} as const;
