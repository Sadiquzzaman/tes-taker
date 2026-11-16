/** The mobile app's platforms (PM-03). */
export type AppPlatform = 'ANDROID' | 'IOS';

export interface AppVersionInfo {
  platform: AppPlatform;
  /** Below this the app must update before it can be used. */
  minimum: string;
  /** The newest release; below it the app may suggest an update. */
  latest: string;
  /** Where to update (store page or download link); null until the app is published. */
  update_url: string | null;
  /** From the version the app sent: NONE, OPTIONAL (below latest) or REQUIRED (below minimum). */
  update: 'NONE' | 'OPTIONAL' | 'REQUIRED' | null;
}

/** Compares dotted versions ("1.10.2" > "1.9"); missing parts count as 0, anything after "-" or "+" is ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .trim()
      .split(/[-+]/)[0]
      .split('.')
      .map((p) => Number.parseInt(p, 10) || 0);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** NONE, OPTIONAL or REQUIRED for the app's current version. */
export function updateNeeded(current: string, minimum: string, latest: string): 'NONE' | 'OPTIONAL' | 'REQUIRED' {
  if (compareVersions(current, minimum) < 0) return 'REQUIRED';
  if (compareVersions(current, latest) < 0) return 'OPTIONAL';
  return 'NONE';
}
