import "server-only";

const DOCKER_INTERNAL_HOST_PATTERN = /\/\/(?:app|backend)(?:[:/]|$)/;

export const getServerApiBaseUrls = (): string[] => {
  const candidates: string[] = [];
  const inDocker = process.env.RUNNING_IN_DOCKER === "true";

  const addCandidate = (url?: string) => {
    const trimmed = url?.trim();
    if (!trimmed) {
      return;
    }

    const normalized = trimmed.replace(/\/+$/, "");
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  const serverApiUrl = process.env.SERVER_API_URL?.trim() || process.env.INTERNAL_API_URL?.trim();
  const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const legacyPublicUrl = process.env.NEXT_PUBLIC_URL?.trim();
  const isDockerInternalHost = (url: string) => DOCKER_INTERNAL_HOST_PATTERN.test(url);

  if (serverApiUrl && (inDocker || !isDockerInternalHost(serverApiUrl))) {
    addCandidate(serverApiUrl);
  }

  addCandidate(publicBaseUrl);

  if (legacyPublicUrl && !isDockerInternalHost(legacyPublicUrl)) {
    addCandidate(legacyPublicUrl);
  }

  if (inDocker) {
    addCandidate("http://host.docker.internal:4000/api/v1");
  }

  return candidates;
};

export const getServerApiBaseUrl = (): string | null => {
  return getServerApiBaseUrls()[0] ?? null;
};
