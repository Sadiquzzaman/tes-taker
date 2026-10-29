import { AcademicSessionStatusEnum } from './entities/academic-session.entity';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';

/**
 * The rules for "this teacher teaches here" (P2-03 part 2b), as SQL conditions for any query.
 * Only sections in sessions that are not closed count. `:teacherId` must be bound by the caller.
 * Aliases are quoted here because TypeORM does not rewrite aliases inside raw subqueries.
 *
 * - teaches a subject of a class: a teacher of that subject class (offering_teachers) in one of
 *   the class's sections;
 * - teaches in a class: a teacher of any of its subject classes, or the class teacher of one of
 *   its sections while the organisation uses class teachers (org_settings, default by kind).
 */
const OPEN_SECTION = `
  JOIN academic_sessions teaching_session ON teaching_session.id = teaching_section.session_id
   AND teaching_session.status = '${AcademicSessionStatusEnum.ACTIVE}'`;

/** The class subject in query alias `classSubjectAlias` is taught by the teacher. */
export function teachesSubjectCondition(classSubjectAlias: string): string {
  const classIdExpr = `"${classSubjectAlias}"."class_id"`;
  const subjectIdExpr = `"${classSubjectAlias}"."subject_id"`;
  return `EXISTS (
    SELECT 1 FROM offering_teachers teaching
    JOIN course_offerings teaching_offering ON teaching_offering.id = teaching.offering_id
    JOIN sections teaching_section ON teaching_section.id = teaching_offering.section_id
    ${OPEN_SECTION}
    WHERE teaching.teacher_id = :teacherId
      AND teaching_section.class_id = ${classIdExpr}
      AND teaching_offering.subject_id = ${subjectIdExpr}
  )`;
}

/** The teacher teaches in the class in query alias `classAlias`, or is the class teacher of one of its sections. */
export function teachesClassCondition(classAlias: string): string {
  const classIdExpr = `"${classAlias}"."id"`;
  return `(EXISTS (
    SELECT 1 FROM offering_teachers teaching
    JOIN course_offerings teaching_offering ON teaching_offering.id = teaching.offering_id
    JOIN sections teaching_section ON teaching_section.id = teaching_offering.section_id
    ${OPEN_SECTION}
    WHERE teaching.teacher_id = :teacherId AND teaching_section.class_id = ${classIdExpr}
  ) OR EXISTS (
    SELECT 1 FROM sections teaching_section
    ${OPEN_SECTION}
    JOIN organizations teaching_org ON teaching_org.id = teaching_section.organization_id
    LEFT JOIN org_settings teaching_settings ON teaching_settings.organization_id = teaching_section.organization_id
    WHERE teaching_section.class_teacher_id = :teacherId
      AND teaching_section.class_id = ${classIdExpr}
      AND COALESCE(teaching_settings.class_teacher_enabled, teaching_org.kind <> '${OrganizationKindEnum.SOLO}')
  ))`;
}
