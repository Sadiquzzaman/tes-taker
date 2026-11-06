import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseOfferingEntity, OfferingEnrolmentModeEnum } from './entities/course-offering.entity';
import { EnrolmentEntity, EnrolmentStatusEnum } from './entities/enrolment.entity';
import { OfferingEnrolmentEntity, OfferingEnrolmentStatusEnum } from './entities/offering-enrolment.entity';

export interface RosterStudent {
  enrolment_id: string;
  student_id: string;
  full_name: string;
  roll_no: string | null;
}

/**
 * Who takes a subject class (design §9.3): every active enrolment of the section for
 * WHOLE_SECTION, only the selected students (who are still active in the section) for SELECTED.
 * The one place this rule lives; every epic asks here.
 */
@Injectable()
export class OfferingRosterService {
  constructor(
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepo: Repository<EnrolmentEntity>,
  ) {}

  async students(offering: Pick<CourseOfferingEntity, 'id' | 'section_id' | 'enrolment_mode' | 'organization_id'>): Promise<RosterStudent[]> {
    const query = this.enrolmentRepo
      .createQueryBuilder('e')
      .innerJoin('e.student', 'student')
      .select(['e.id AS enrolment_id', 'e.student_id AS student_id', 'student.full_name AS full_name', 'e.roll_no AS roll_no'])
      .where('e.organization_id = :organizationId AND e.section_id = :sectionId AND e.status = :active', {
        organizationId: offering.organization_id,
        sectionId: offering.section_id,
        active: EnrolmentStatusEnum.ACTIVE,
      });
    if (offering.enrolment_mode === OfferingEnrolmentModeEnum.SELECTED) {
      query.innerJoin(
        OfferingEnrolmentEntity,
        'oe',
        'oe.offering_id = :offeringId AND oe.student_id = e.student_id AND oe.status = :taking',
        { offeringId: offering.id, taking: OfferingEnrolmentStatusEnum.ACTIVE },
      );
    }
    return query.orderBy('e.roll_no', 'ASC', 'NULLS LAST').addOrderBy('student.full_name', 'ASC').getRawMany<RosterStudent>();
  }

  /**
   * The subject classes a student takes in open sessions (the same rule as `students`): every
   * offering of their active sections taken by the whole section, and SELECTED ones they are in.
   */
  async offeringIdsOfStudent(organizationId: string, studentId: string): Promise<string[]> {
    const rows: { id: string }[] = await this.enrolmentRepo.manager.query(
      `SELECT o.id FROM enrolments e
         JOIN course_offerings o ON o.section_id = e.section_id
         JOIN academic_sessions s ON s.id = o.session_id AND s.status = 'ACTIVE'
        WHERE e.organization_id = $1 AND e.student_id = $2 AND e.status = $3
          AND (o.enrolment_mode = $4 OR EXISTS (
            SELECT 1 FROM offering_enrolments oe
             WHERE oe.offering_id = o.id AND oe.student_id = e.student_id AND oe.status = $5))`,
      [organizationId, studentId, EnrolmentStatusEnum.ACTIVE, OfferingEnrolmentModeEnum.WHOLE_SECTION, OfferingEnrolmentStatusEnum.ACTIVE],
    );
    return [...new Set(rows.map((row) => row.id))];
  }
}
