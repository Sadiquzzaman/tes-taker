import "server-only";

const isDockerInternalHost = (url: string) => /\/\/(?:app|backend)(?:[:/]|$)/.test(url);

export const getServerApiBaseUrl = (): string | null => {
  const internalApiUrl = process.env.INTERNAL_API_URL?.trim();
  if (internalApiUrl) {
    return internalApiUrl;
  }

  const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const legacyPublicUrl = process.env.NEXT_PUBLIC_URL?.trim();

  if (legacyPublicUrl && isDockerInternalHost(legacyPublicUrl) && publicBaseUrl) {
    return publicBaseUrl;
  }

  return legacyPublicUrl ?? publicBaseUrl ?? null;
};
