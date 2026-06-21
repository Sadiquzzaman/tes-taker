type ScreenDetailsLike = {
  screens: Array<{ width: number; height: number; left: number; top: number }>;
};

export const hasMultipleDisplays = async () => {
  if (window.getScreenDetails) {
    try {
      const details = (await window.getScreenDetails()) as ScreenDetailsLike;

      if (details.screens.length > 1) {
        return true;
      }
    } catch {
      // Permission denied or API unavailable.
    }
  }

  if (window.screen.isExtended) {
    return true;
  }

  const screenWithAvail = window.screen as Screen & {
    availLeft?: number;
    availTop?: number;
  };

  if (
    typeof screenWithAvail.availLeft === "number" &&
    typeof screenWithAvail.availTop === "number" &&
    (screenWithAvail.availLeft !== 0 || screenWithAvail.availTop !== 0)
  ) {
    return true;
  }

  return window.screen.availWidth !== window.screen.width;
};

export const requestDisplayEnvironmentAccess = async () => {
  if (!window.getScreenDetails) {
    return;
  }

  try {
    await window.getScreenDetails();
  } catch {
    // Best-effort permission prompt for multi-display detection.
  }
};
