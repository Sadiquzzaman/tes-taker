const resolveOrigin = (value?: string) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const getProctoringSocketUrl = (socketUrl?: string, baseUrl?: string): string | null =>
  resolveOrigin(socketUrl) ?? resolveOrigin(baseUrl);
