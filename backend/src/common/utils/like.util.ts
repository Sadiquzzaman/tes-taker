/**
 * Escapes `\`, `%` and `_` so a value matches itself literally inside LIKE / ILIKE.
 * PostgreSQL's default LIKE escape character is the backslash.
 * Use it for exact case-insensitive comparisons such as `ILike(escapeLikePattern(name))`.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
