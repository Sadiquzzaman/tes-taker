import { QueryFailedError } from 'typeorm';

const PG_UNIQUE_VIOLATION = '23505';

/**
 * True when `error` is PostgreSQL's unique violation on `constraint`.
 * Use it to turn a lost insert race into the same 4xx the pre-check returns.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string; constraint?: string } | undefined;
  return driverError?.code === PG_UNIQUE_VIOLATION && driverError.constraint === constraint;
}
