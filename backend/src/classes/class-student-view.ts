import { EnrolmentEntity, EnrolmentStatusEnum } from 'src/academics/entities/enrolment.entity';
import { UserEntity } from 'src/user/entities/user.entity';

/** The class screens' student status (the former class_students.status). */
export enum ClassStudentStatusEnum {
  INVITED = 'INVITED',
  PENDING = 'PENDING',
  JOINED = 'JOINED',
}

/**
 * A class student as the class screens have always received it (the class_students row shape),
 * built from an enrolment since P2-03 part 2a (class_students was dropped in P2-03). `id` is the
 * enrolment id; `section` and `roll_no` are new.
 */
export interface ClassStudentView {
  id: string;
  class_id: string;
  student_id: string | null;
  student: UserEntity | null;
  status: ClassStudentStatusEnum;
  invited_email: string | null;
  invited_phone: string | null;
  invitation_token: string | null;
  invited_at: Date | null;
  joined_at: Date | null;
  approved_at: Date | null;
  approved_by: string | null;
  created_at: Date;
  roll_no: string | null;
  section: { id: string; name: string } | null;
}

const LEGACY_STATUS: Partial<Record<EnrolmentStatusEnum, ClassStudentStatusEnum>> = {
  [EnrolmentStatusEnum.INVITED]: ClassStudentStatusEnum.INVITED,
  [EnrolmentStatusEnum.PENDING]: ClassStudentStatusEnum.PENDING,
  [EnrolmentStatusEnum.ACTIVE]: ClassStudentStatusEnum.JOINED,
};

/** The enrolment fields the view needs (a plain object is fine). */
export type EnrolmentRow = Pick<
  EnrolmentEntity,
  'id' | 'class_id' | 'student_id' | 'status' | 'invited_email' | 'invited_phone' | 'invitation_token' | 'joined_at' | 'created_at' | 'created_by' | 'updated_by' | 'roll_no'
> & { student?: UserEntity | null; section?: { id: string; name: string } | null };

export function toClassStudentView(enrolment: EnrolmentRow): ClassStudentView {
  const joined = enrolment.status === EnrolmentStatusEnum.ACTIVE;
  return {
    id: enrolment.id,
    class_id: enrolment.class_id,
    student_id: enrolment.student_id,
    student: enrolment.student ?? null,
    status: LEGACY_STATUS[enrolment.status] ?? ClassStudentStatusEnum.INVITED,
    invited_email: enrolment.invited_email,
    invited_phone: enrolment.invited_phone,
    invitation_token: enrolment.invitation_token,
    invited_at: enrolment.status === EnrolmentStatusEnum.INVITED ? enrolment.created_at : null,
    joined_at: enrolment.joined_at,
    approved_at: joined ? enrolment.joined_at : null,
    approved_by: joined ? enrolment.updated_by ?? enrolment.created_by : null,
    created_at: enrolment.created_at,
    roll_no: enrolment.roll_no,
    section: enrolment.section ? { id: enrolment.section.id, name: enrolment.section.name } : null,
  };
}
