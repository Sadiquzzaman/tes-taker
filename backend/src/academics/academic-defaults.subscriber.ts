import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, EntityMetadata, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { ClassSubjectTeacherEntity } from 'src/classes/entities/class-subject-teacher.entity';
import { ClassTeacherEntity } from 'src/classes/entities/class-teacher.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { AcademicSessionsService } from './academic-sessions.service';
import { EnrolmentsService } from './enrolments.service';

/** Subject classes of a class subject in the class's sections of open sessions. */
const OPEN_OFFERINGS = `
  SELECT o.id, o.organization_id
  FROM course_offerings o
  JOIN sections s ON s.id = o.section_id
  JOIN academic_sessions ses ON ses.id = s.session_id AND ses.status = 'ACTIVE'
  WHERE s.class_id = $1 AND o.subject_id = $2 AND o.term_id IS NULL
`;

/**
 * Keeps the new academic tables in step with the legacy class tables the class screens still write
 * (P2-03). Students no longer go through here: since part 2a the class screens write enrolments
 * through EnrolmentsService and class_students is read-only. The class module's writes reach here
 * as TypeORM entity events, in the same transaction:
 *
 * - a new class gets section "A" in its organisation's default session;
 * - class subjects become subject classes in the class's sections of open sessions;
 * - subject teachers and class teachers become teachers of those subject classes (a class teacher
 *   without a subject teaches all of them) and are removed when their last legacy link goes;
 * - a new exam gets its organisation's default session.
 *
 * Only legacy rows written through TypeORM entities are seen; the class module writes no other way.
 */
/** Whether an event is about `entity` (saved plain objects are not instances, so match the metadata). */
const is = (metadata: EntityMetadata | undefined, entity: { new (): unknown }): boolean => metadata?.target === entity;

@Injectable()
export class LegacyClassSyncSubscriber implements EntitySubscriberInterface {
  constructor(
    dataSource: DataSource,
    private readonly sessions: AcademicSessionsService,
    private readonly enrolments: EnrolmentsService,
  ) {
    dataSource.subscribers.push(this);
  }

  async beforeInsert(event: InsertEvent<unknown>): Promise<void> {
    if (is(event.metadata, ExamEntity)) {
      const exam = event.entity as ExamEntity;
      if (exam.organization_id && !exam.session_id) {
        exam.session_id = (await this.sessions.ensureDefault(exam.organization_id, event.manager)).id;
      }
    }
  }

  async afterInsert(event: InsertEvent<unknown>): Promise<void> {
    const { metadata, manager } = event;
    if (is(metadata, ClassEntity)) {
      const classEntity = event.entity as ClassEntity;
      if (classEntity.organization_id) await this.enrolments.defaultSection(classEntity.id, classEntity.organization_id, manager);
    } else if (is(metadata, ClassSubjectEntity)) {
      const classSubject = event.entity as ClassSubjectEntity;
      await this.addSubject(manager, classSubject.class_id, classSubject.subject_id);
    } else if (is(metadata, ClassSubjectTeacherEntity)) {
      const assignment = event.entity as ClassSubjectTeacherEntity;
      const link = await this.classSubject(manager, assignment.class_subject_id);
      if (link) await this.addTeacher(manager, link.class_id, [link.subject_id], assignment.teacher_id);
    } else if (is(metadata, ClassTeacherEntity)) {
      const classTeacher = event.entity as ClassTeacherEntity;
      await this.addTeacher(manager, classTeacher.class_id, await this.subjectsOf(manager, classTeacher), classTeacher.teacher_id);
    }
  }

  async afterUpdate(event: UpdateEvent<unknown>): Promise<void> {
    const entity = event.entity as { id?: string } | undefined;
    if (!entity?.id) return;
    if (is(event.metadata, ClassSubjectTeacherEntity)) {
      const after = entity as ClassSubjectTeacherEntity;
      const before = event.databaseEntity as ClassSubjectTeacherEntity | undefined;
      const link = await this.classSubject(event.manager, after.class_subject_id);
      if (!link || before?.teacher_id === after.teacher_id) return;
      if (before?.teacher_id) await this.removeTeacherIfUnlinked(event.manager, link.class_id, [link.subject_id], before.teacher_id, after.id);
      await this.addTeacher(event.manager, link.class_id, [link.subject_id], after.teacher_id);
    }
  }

  async beforeRemove(event: RemoveEvent<unknown>): Promise<void> {
    const { metadata, manager } = event;
    const entity = (event.databaseEntity ?? event.entity) as { id?: string } | undefined;
    if (!entity?.id) return;
    if (is(metadata, ClassSubjectEntity)) {
      const classSubject = entity as ClassSubjectEntity;
      await manager.query(`DELETE FROM course_offerings WHERE id IN (SELECT id FROM (${OPEN_OFFERINGS}) o)`, [classSubject.class_id, classSubject.subject_id]);
    } else if (is(metadata, ClassSubjectTeacherEntity)) {
      const assignment = entity as ClassSubjectTeacherEntity;
      const link = await this.classSubject(manager, assignment.class_subject_id);
      if (link) await this.removeTeacherIfUnlinked(manager, link.class_id, [link.subject_id], assignment.teacher_id, assignment.id);
    } else if (is(metadata, ClassTeacherEntity)) {
      const classTeacher = entity as ClassTeacherEntity;
      await this.removeTeacherIfUnlinked(manager, classTeacher.class_id, await this.subjectsOf(manager, classTeacher), classTeacher.teacher_id, classTeacher.id);
    }
  }

  /** A new class subject: a subject class in each section (open sessions), taught by the class teachers without a subject. */
  private async addSubject(manager: EntityManager, classId: string, subjectId: string): Promise<void> {
    await manager.query(
      `
      INSERT INTO course_offerings (organization_id, session_id, section_id, subject_id, created_at, is_active)
      SELECT s.organization_id, s.session_id, s.id, $2::uuid, now(), '1'
      FROM sections s JOIN academic_sessions ses ON ses.id = s.session_id AND ses.status = 'ACTIVE'
      WHERE s.class_id = $1
        AND NOT EXISTS (SELECT 1 FROM course_offerings o WHERE o.section_id = s.id AND o.subject_id = $2 AND o.term_id IS NULL)
      `,
      [classId, subjectId],
    );
    const classTeachers: Array<{ teacher_id: string }> = await manager.query(
      `SELECT DISTINCT teacher_id FROM class_teachers WHERE class_id = $1 AND subject_id IS NULL`,
      [classId],
    );
    for (const { teacher_id } of classTeachers) {
      await this.addTeacher(manager, classId, [subjectId], teacher_id);
    }
  }

  private async addTeacher(manager: EntityManager, classId: string, subjectIds: string[], teacherId: string): Promise<void> {
    for (const subjectId of subjectIds) {
      await manager.query(
        `
        INSERT INTO offering_teachers (organization_id, offering_id, teacher_id, created_at, is_active)
        SELECT o.organization_id, o.id, $3::uuid, now(), '1' FROM (${OPEN_OFFERINGS}) o
        ON CONFLICT DO NOTHING
        `,
        [classId, subjectId, teacherId],
      );
    }
  }

  /** Removes the teacher unless another legacy row (other than `exceptId`) still links them to the subject. */
  private async removeTeacherIfUnlinked(
    manager: EntityManager,
    classId: string,
    subjectIds: string[],
    teacherId: string,
    exceptId: string,
  ): Promise<void> {
    for (const subjectId of subjectIds) {
      const [{ linked }] = await manager.query(
        `
        SELECT EXISTS (
          SELECT 1 FROM class_subject_teachers cst JOIN class_subjects cs ON cs.id = cst.class_subject_id
          WHERE cs.class_id = $1 AND cs.subject_id = $2 AND cst.teacher_id = $3 AND cst.id <> $4
        ) OR EXISTS (
          SELECT 1 FROM class_teachers ct
          WHERE ct.class_id = $1 AND ct.teacher_id = $3 AND (ct.subject_id = $2 OR ct.subject_id IS NULL) AND ct.id <> $4
        ) AS linked
        `,
        [classId, subjectId, teacherId, exceptId],
      );
      if (!linked) {
        await manager.query(
          `DELETE FROM offering_teachers WHERE teacher_id = $3 AND offering_id IN (SELECT id FROM (${OPEN_OFFERINGS}) o)`,
          [classId, subjectId, teacherId],
        );
      }
    }
  }

  private async classSubject(manager: EntityManager, classSubjectId: string): Promise<ClassSubjectEntity | null> {
    return manager.getRepository(ClassSubjectEntity).findOne({ where: { id: classSubjectId } });
  }

  /** A class teacher with a subject teaches that subject; without one, every subject of the class. */
  private async subjectsOf(manager: EntityManager, classTeacher: ClassTeacherEntity): Promise<string[]> {
    if (classTeacher.subject_id) return [classTeacher.subject_id];
    const rows = await manager.getRepository(ClassSubjectEntity).find({ where: { class_id: classTeacher.class_id } });
    return rows.map((row) => row.subject_id);
  }
}
