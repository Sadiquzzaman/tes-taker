import { ObjectLiteral, Repository } from 'typeorm';
import { AcademicSessionStatusEnum } from './entities/academic-session.entity';
import { EnrolmentEntity, EnrolmentStatusEnum } from './entities/enrolment.entity';

/**
 * The one rule for "this student is in the class" (P2-03): an ACTIVE enrolment in a session that is
 * not closed, or, when a session is given (an exam's session), an ACTIVE enrolment in that session.
 * Every module that reads enrolments joins with this condition; writes go through EnrolmentsService.
 *
 *   qb.innerJoin(EnrolmentEntity, 'e', `e.class_id = class.id AND e.student_id = :studentId AND ${cond.sql}`, { studentId, ...cond.params })
 */
export function activeEnrolmentCondition(alias: string, sessionId?: string | null): { sql: string; params: ObjectLiteral } {
  const active = `${alias}.status = '${EnrolmentStatusEnum.ACTIVE}' AND ${alias}.student_id IS NOT NULL`;
  if (sessionId) {
    return { sql: `${active} AND ${alias}.session_id = :activeEnrolmentSessionId`, params: { activeEnrolmentSessionId: sessionId } };
  }
  return { sql: `${active} AND ${openSessionCondition(alias)}`, params: {} };
}

/** The enrolment's session is not closed. */
export function openSessionCondition(alias: string): string {
  return `EXISTS (SELECT 1 FROM academic_sessions enrolment_session WHERE enrolment_session.id = ${alias}.session_id AND enrolment_session.status = '${AcademicSessionStatusEnum.ACTIVE}')`;
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
