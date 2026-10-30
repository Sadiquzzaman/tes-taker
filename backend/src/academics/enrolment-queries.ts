import { ObjectLiteral, Repository } from 'typeorm';
import { AcademicSessionStatusEnum } from './entities/academic-session.entity';
import { OfferingEnrolmentModeEnum } from './entities/course-offering.entity';
import { EnrolmentEntity, EnrolmentStatusEnum } from './entities/enrolment.entity';
import { OfferingEnrolmentStatusEnum } from './entities/offering-enrolment.entity';

/**
 * The one rule for "this student is in the class" (P2-03): an ACTIVE enrolment in a session that is
 * not closed, or, when a session is given (an exam's session), an ACTIVE enrolment in that session.
 * Every module that reads enrolments joins with this condition; writes go through EnrolmentsService.
 * Aliases are quoted because TypeORM does not rewrite aliases inside raw subqueries.
 *
 *   qb.innerJoin(EnrolmentEntity, 'e', `e.class_id = class.id AND e.student_id = :studentId AND ${cond.sql}`, { studentId, ...cond.params })
 */
export function activeEnrolmentCondition(alias: string, sessionId?: string | null): { sql: string; params: ObjectLiteral } {
  const active = `"${alias}"."status" = '${EnrolmentStatusEnum.ACTIVE}' AND "${alias}"."student_id" IS NOT NULL`;
  if (sessionId) {
    return { sql: `${active} AND "${alias}"."session_id" = :activeEnrolmentSessionId`, params: { activeEnrolmentSessionId: sessionId } };
  }
  return { sql: `${active} AND ${openSessionCondition(alias)}`, params: {} };
}

/** The enrolment's session is not closed. */
export function openSessionCondition(alias: string): string {
  return `EXISTS (SELECT 1 FROM academic_sessions enrolment_session WHERE enrolment_session.id = "${alias}"."session_id" AND enrolment_session.status = '${AcademicSessionStatusEnum.ACTIVE}')`;
}

/** Statuses that are still part of a class (shown on class screens): not LEFT or PROMOTED. */
export const CURRENT_ENROLMENT_STATUSES = [EnrolmentStatusEnum.INVITED, EnrolmentStatusEnum.PENDING, EnrolmentStatusEnum.ACTIVE];

/** Active students of a class (in the given session, or in open sessions), one row per student. */
export async function activeStudentsOfClass(
  repo: Repository<EnrolmentEntity>,
  classId: string,
  sessionId?: string | null,
): Promise<EnrolmentEntity[]> {
  const active = activeEnrolmentCondition('e', sessionId);
  const rows = await repo
    .createQueryBuilder('e')
    .innerJoinAndSelect('e.student', 'student')
    .where('e.class_id = :classId', { classId })
    .andWhere(active.sql, active.params)
    .orderBy('e.created_at', 'ASC')
    .getMany();
  const byStudent = new Map<string, EnrolmentEntity>();
  for (const row of rows) {
    if (row.student_id && !byStudent.has(row.student_id)) byStudent.set(row.student_id, row);
  }
  return [...byStudent.values()];
}

/** Number of active students per class (in open sessions). */
export async function countActiveByClass(repo: Repository<EnrolmentEntity>, classIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (classIds.length === 0) return counts;
  const active = activeEnrolmentCondition('e');
  const rows = await repo
    .createQueryBuilder('e')
    .select('e.class_id', 'class_id')
    .addSelect('COUNT(DISTINCT e.student_id)', 'cnt')
    .where('e.class_id IN (:...classIds)', { classIds })
    .andWhere(active.sql, active.params)
    .groupBy('e.class_id')
    .getRawMany<{ class_id: string; cnt: string }>();
  rows.forEach((row) => counts.set(row.class_id, Number(row.cnt) || 0));
  return counts;
}

/** Whether the student is active in the class (in the given session, or in an open session). */
export async function isActiveInClass(
  repo: Repository<EnrolmentEntity>,
  classId: string,
  studentId: string,
  sessionId?: string | null,
): Promise<boolean> {
  const active = activeEnrolmentCondition('e', sessionId);
  const count = await repo
    .createQueryBuilder('e')
    .where('e.class_id = :classId AND e.student_id = :studentId', { classId, studentId })
    .andWhere(active.sql, active.params)
    .getCount();
  return count > 0;
}

/**
 * Active enrolments that take a subject class (alias `e`): ACTIVE in its section, and for a SELECTED
 * subject class also picked (offering_enrolments). The same rule as OfferingRosterService.
 */
function offeringRosterQuery(repo: Repository<EnrolmentEntity>, offeringId: string) {
  return repo
    .createQueryBuilder('e')
    .innerJoin('course_offerings', 'roster_offering', 'roster_offering.id = :rosterOfferingId AND roster_offering.section_id = e.section_id', {
      rosterOfferingId: offeringId,
    })
    .where(`e.status = '${EnrolmentStatusEnum.ACTIVE}' AND e.student_id IS NOT NULL`)
    .andWhere(
      `(roster_offering.enrolment_mode = '${OfferingEnrolmentModeEnum.WHOLE_SECTION}' OR EXISTS (
        SELECT 1 FROM offering_enrolments roster_pick
        WHERE roster_pick.offering_id = roster_offering.id AND roster_pick.student_id = e.student_id
          AND roster_pick.status = '${OfferingEnrolmentStatusEnum.ACTIVE}'
      ))`,
    );
}

/** An exam that targets a class: the whole class (in its session) or one of its subject classes. */
type ClassExam = { class_id: string | null; session_id: string | null; offering_id: string | null };

/** The exam's class audience: its subject class's students, or the class's active students in the exam's session. */
export async function examClassAudience(repo: Repository<EnrolmentEntity>, exam: ClassExam): Promise<EnrolmentEntity[]> {
  if (exam.offering_id) {
    return offeringRosterQuery(repo, exam.offering_id).innerJoinAndSelect('e.student', 'student').orderBy('e.roll_no', 'ASC', 'NULLS LAST').getMany();
  }
  return exam.class_id ? activeStudentsOfClass(repo, exam.class_id, exam.session_id) : [];
}

/** Whether the student is in the exam's class audience (see examClassAudience). */
export async function isInExamClassAudience(repo: Repository<EnrolmentEntity>, exam: ClassExam, studentId: string): Promise<boolean> {
  if (exam.offering_id) {
    return (await offeringRosterQuery(repo, exam.offering_id).andWhere('e.student_id = :studentId', { studentId }).getCount()) > 0;
  }
  return exam.class_id ? isActiveInClass(repo, exam.class_id, studentId, exam.session_id) : false;
}

/** Number of students who take each subject class. */
export async function countRosterByOffering(repo: Repository<EnrolmentEntity>, offeringIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const offeringId of new Set(offeringIds)) {
    counts.set(offeringId, await offeringRosterQuery(repo, offeringId).getCount());
  }
  return counts;
}

/**
 * SQL for "the student `:studentParam` takes the subject class `offeringIdExpr`", for filtering
 * exam lists inside a larger query (quoted aliases: TypeORM does not rewrite raw subqueries).
 */
export function inOfferingRosterCondition(offeringIdExpr: string, studentParam = 'studentId'): string {
  return `EXISTS (
    SELECT 1 FROM course_offerings roster_offering
    JOIN enrolments roster_enrolment ON roster_enrolment.section_id = roster_offering.section_id
     AND roster_enrolment.status = '${EnrolmentStatusEnum.ACTIVE}' AND roster_enrolment.student_id = :${studentParam}
    WHERE roster_offering.id = ${offeringIdExpr}
      AND (roster_offering.enrolment_mode = '${OfferingEnrolmentModeEnum.WHOLE_SECTION}' OR EXISTS (
        SELECT 1 FROM offering_enrolments roster_pick
        WHERE roster_pick.offering_id = roster_offering.id AND roster_pick.student_id = roster_enrolment.student_id
          AND roster_pick.status = '${OfferingEnrolmentStatusEnum.ACTIVE}'
      ))
  )`;
}
