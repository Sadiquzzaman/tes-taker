/**
 * Browser-facing app origin for join/share links.
 * Prefer NEXT_PUBLIC_APP_URL; fall back to window origin in the browser.
 */
export const getFrontendAppUrl = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
};

export const buildClassJoinLink = (classId: string): string =>
  `${getFrontendAppUrl()}/join/class/${encodeURIComponent(classId)}`;

export const buildTestJoinLink = (testId: string): string =>
  `${getFrontendAppUrl()}/join/test/${encodeURIComponent(testId)}`;
