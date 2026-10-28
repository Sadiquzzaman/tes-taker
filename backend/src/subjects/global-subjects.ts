import { IsNull } from 'typeorm';

/**
 * The platform's shared subject list (subjects with no organisation), as opposed to an
 * organisation's own catalog. Use it in `where`: `{ name, ...globalSubjects() }`.
 */
export const globalSubjects = () => ({ organization_id: IsNull() });
