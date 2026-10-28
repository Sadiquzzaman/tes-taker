/**
 * What kind of account an organisation is (design §8.1, schema.dbml `org_kind`).
 * SOLO is a single teacher's own workspace: it replaces the old "personal teacher" mode, so
 * every class and exam belongs to an organisation. COLLEGE and UNIVERSITY are reserved.
 */
export enum OrganizationKindEnum {
  SCHOOL = 'SCHOOL',
  COACHING = 'COACHING',
  IELTS_CENTRE = 'IELTS_CENTRE',
  SOLO = 'SOLO',
  COLLEGE = 'COLLEGE',
  UNIVERSITY = 'UNIVERSITY',
}
