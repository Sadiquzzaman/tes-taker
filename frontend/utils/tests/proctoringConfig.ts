const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

export const PROCTORING_CONFIG = {
  enableFlagging: process.env.NEXT_PUBLIC_ENABLE_FLAGGING !== "false",
  greenLimit: parsePositiveInt(process.env.NEXT_PUBLIC_GREEN_LIMIT, 5),
  lightGreenLimit: parsePositiveInt(process.env.NEXT_PUBLIC_LIGHT_GREEN_LIMIT, 10),
  orangeLimit: parsePositiveInt(process.env.NEXT_PUBLIC_ORANGE_LIMIT, 14),
  redLimit: parsePositiveInt(process.env.NEXT_PUBLIC_RED_LIMIT, 15),
  disqualifyAfter: parsePositiveInt(process.env.NEXT_PUBLIC_DISQUALIFY_AFTER, 15),
  screenShareTimeout: parsePositiveInt(process.env.NEXT_PUBLIC_SCREEN_SHARE_TIMEOUT, 15),
  doubleDisplayTimeout: parsePositiveInt(process.env.NEXT_PUBLIC_DOUBLE_DISPLAY_TIMEOUT, 15),
} as const;
