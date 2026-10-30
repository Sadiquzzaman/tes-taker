import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, EntityMetadata, EntitySubscriberInterface, InsertEvent, RemoveEvent } from 'typeorm';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { AcademicSessionsService } from './academic-sessions.service';
import { EnrolmentsService } from './enrolments.service';

/** Subject classes of a class subject in the class's sections of open sessions. */
const OPEN_OFFERINGS = `
  SELECT o.id
  FROM course_offerings o
  JOIN sections s ON s.id = o.section_id
  JOIN academic_sessions ses ON ses.id = s.session_id AND ses.status = 'ACTIVE'
  WHERE s.class_id = $1 AND o.subject_id = $2 AND o.term_id IS NULL
`;

/** Whether an event is about `entity` (saved plain objects are not instances, so match the metadata). */
const is = (metadata: EntityMetadata | undefined, entity: { new (): unknown }): boolean => metadata?.target === entity;

/**
 * The academic structure's defaults (P2-03), applied however a class, class subject or exam is
 * written (class and exam services, seeds, tests), in the same transaction:
 *
 * - a new class gets section "A" in its organisation's default session (a class has at least one);
 * - a class subject becomes a subject class in each section of the class in open sessions, and
 *   removing the class subject removes those subject classes;
 * - a new exam gets its organisation's default session.
 *
 * Until P2-03's contract step this also mirrored the legacy class student and teacher tables.
 */
@Injectable()
export class AcademicDefaultsSubscriber implements EntitySubscriberInterface {
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
    }
  }

  async beforeRemove(event: RemoveEvent<unknown>): Promise<void> {
    const entity = (event.databaseEntity ?? event.entity) as ClassSubjectEntity | undefined;
    if (is(event.metadata, ClassSubjectEntity) && entity?.class_id) {
      await event.manager.query(`DELETE FROM course_offerings WHERE id IN (SELECT id FROM (${OPEN_OFFERINGS}) o)`, [entity.class_id, entity.subject_id]);
    }
  }

  /** A new class subject: a subject class in each section of the class in open sessions. */
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
  }
}
