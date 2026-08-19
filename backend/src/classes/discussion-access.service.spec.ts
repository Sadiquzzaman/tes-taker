import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { ClassStudentStatusEnum } from './entities/class-student.entity';
import { DiscussionAccessService } from './discussion-access.service';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const CLASS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLASS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PHYSICS_CS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CHEMISTRY_CS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONV_PHYSICS = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const orgClass = {
  id: CLASS_A,
  organization_id: ORG,
  teacher_id: 'owner-1',
};

const personalClass = {
  id: CLASS_A,
  organization_id: null,
  teacher_id: 'owner-1',
};

const physicsSubject = {
  id: PHYSICS_CS,
  class_id: CLASS_A,
  is_active: ActiveStatusEnum.ACTIVE,
  class: orgClass,
  subject: { id: 'sub-phy', name: 'Physics', code: 'PHY' },
};

const chemistrySubject = {
  id: CHEMISTRY_CS,
  class_id: CLASS_A,
  is_active: ActiveStatusEnum.ACTIVE,
  class: orgClass,
  subject: { id: 'sub-chem', name: 'Chemistry', code: 'CHM' },
};

function jwt(partial: Partial<JwtPayloadInterface> & Pick<JwtPayloadInterface, 'id' | 'role'>): JwtPayloadInterface {
  return {
    email: `${partial.id}@school.test`,
    full_name: partial.id,
    phone: '000',
    session_mode: 'organization',
    organization_id: ORG,
    ...partial,
  };
}

describe('DiscussionAccessService', () => {
  let classRepo: { findOne: jest.Mock };
  let classSubjectRepo: { findOne: jest.Mock };
  let classStudentRepo: { findOne: jest.Mock };
  let conversationRepo: { findOne: jest.Mock };
  let organizationAccess: { isAssignedToClassSubject: jest.Mock };
  let service: DiscussionAccessService;

  beforeEach(() => {
    classRepo = { findOne: jest.fn() };
    classSubjectRepo = { findOne: jest.fn() };
    classStudentRepo = { findOne: jest.fn() };
    conversationRepo = { findOne: jest.fn() };
    organizationAccess = { isAssignedToClassSubject: jest.fn() };
    service = new DiscussionAccessService(
      classRepo as never,
      classSubjectRepo as never,
      classStudentRepo as never,
      conversationRepo as never,
      organizationAccess as never,
    );
  });

  it('1. Physics teacher cannot access Chemistry discussions', async () => {
    classSubjectRepo.findOne.mockResolvedValue(chemistrySubject);
    organizationAccess.isAssignedToClassSubject.mockResolvedValue(false);

    await expect(
      service.assertCanAccessClassSubject(CLASS_A, CHEMISTRY_CS, jwt({ id: 'physics-teacher', role: RolesEnum.TEACHER })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('2. Chemistry teacher cannot access Physics discussions', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    organizationAccess.isAssignedToClassSubject.mockResolvedValue(false);

    await expect(
      service.assertCanAccessClassSubject(CLASS_A, PHYSICS_CS, jwt({ id: 'chem-teacher', role: RolesEnum.TEACHER })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('3. Student in class A cannot access a class B subject via URL classSubjectId', async () => {
    classSubjectRepo.findOne.mockResolvedValue({
      ...physicsSubject,
      class_id: CLASS_B,
      class: { ...orgClass, id: CLASS_B },
    });

    await expect(
      service.assertCanAccessClassSubject(CLASS_A, PHYSICS_CS, jwt({ id: 'student-a', role: RolesEnum.STUDENT })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('4. Non-JOINED student cannot access class subject discussions', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    classStudentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.assertCanAccessClassSubject(CLASS_A, PHYSICS_CS, jwt({ id: 'pending-student', role: RolesEnum.STUDENT })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('5. Other student cannot access a private conversation', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    classStudentRepo.findOne.mockResolvedValue({
      class_id: CLASS_A,
      student_id: 'other-student',
      status: ClassStudentStatusEnum.JOINED,
      is_active: ActiveStatusEnum.ACTIVE,
    });
    conversationRepo.findOne.mockResolvedValue({
      id: CONV_PHYSICS,
      class_id: CLASS_A,
      class_subject_id: PHYSICS_CS,
      student_id: 'student-a',
      teacher_id: 'physics-teacher',
      is_active: ActiveStatusEnum.ACTIVE,
    });

    await expect(
      service.assertCanAccessConversation(
        CLASS_A,
        PHYSICS_CS,
        CONV_PHYSICS,
        jwt({ id: 'other-student', role: RolesEnum.STUDENT }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('6. Other assigned teacher cannot access a private conversation they are not in', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    organizationAccess.isAssignedToClassSubject.mockResolvedValue(true);
    conversationRepo.findOne.mockResolvedValue({
      id: CONV_PHYSICS,
      class_id: CLASS_A,
      class_subject_id: PHYSICS_CS,
      student_id: 'student-a',
      teacher_id: 'physics-teacher',
      is_active: ActiveStatusEnum.ACTIVE,
    });

    await expect(
      service.assertCanAccessConversation(
        CLASS_A,
        PHYSICS_CS,
        CONV_PHYSICS,
        jwt({ id: 'other-physics-teacher', role: RolesEnum.TEACHER }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('7. User from another organization cannot access the class subject', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);

    await expect(
      service.assertCanAccessClassSubject(
        CLASS_A,
        PHYSICS_CS,
        jwt({
          id: 'other-org-teacher',
          role: RolesEnum.TEACHER,
          organization_id: OTHER_ORG,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('8. Tampered classSubjectId that belongs to another class returns 404', async () => {
    classSubjectRepo.findOne.mockResolvedValue({
      ...chemistrySubject,
      class_id: CLASS_B,
    });

    await expect(
      service.assertCanAccessClassSubject(CLASS_A, CHEMISTRY_CS, jwt({ id: 'physics-teacher', role: RolesEnum.TEACHER })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('9. Tampered conversationId from another class subject returns 404', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    organizationAccess.isAssignedToClassSubject.mockResolvedValue(true);
    conversationRepo.findOne.mockResolvedValue({
      id: CONV_PHYSICS,
      class_id: CLASS_A,
      class_subject_id: CHEMISTRY_CS,
      student_id: 'student-a',
      teacher_id: 'physics-teacher',
      is_active: ActiveStatusEnum.ACTIVE,
    });

    await expect(
      service.assertCanAccessConversation(
        CLASS_A,
        PHYSICS_CS,
        CONV_PHYSICS,
        jwt({ id: 'physics-teacher', role: RolesEnum.TEACHER }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('10. Academic manager without CST cannot access subject discussions', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    organizationAccess.isAssignedToClassSubject.mockResolvedValue(false);

    await expect(
      service.assertCanAccessClassSubject(
        CLASS_A,
        PHYSICS_CS,
        jwt({ id: 'org-owner', role: RolesEnum.TEACHER, member_role: 'OWNER' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('11. Individual class owner can access every class subject on that class', async () => {
    classSubjectRepo.findOne.mockResolvedValue({
      ...physicsSubject,
      class: personalClass,
      class_id: CLASS_A,
    });

    await expect(
      service.assertCanAccessClassSubject(
        CLASS_A,
        PHYSICS_CS,
        jwt({
          id: 'owner-1',
          role: RolesEnum.TEACHER,
          session_mode: 'individual',
          organization_id: undefined,
        }),
      ),
    ).resolves.toMatchObject({ classSubject: { id: PHYSICS_CS } });
  });

  it('12. JOINED student can access class subjects on that class', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    classStudentRepo.findOne.mockResolvedValue({
      class_id: CLASS_A,
      student_id: 'student-a',
      status: ClassStudentStatusEnum.JOINED,
      is_active: ActiveStatusEnum.ACTIVE,
    });

    await expect(
      service.assertCanAccessClassSubject(CLASS_A, PHYSICS_CS, jwt({ id: 'student-a', role: RolesEnum.STUDENT })),
    ).resolves.toMatchObject({ classSubject: { id: PHYSICS_CS } });
  });

  it('13. Physics teacher with CST can access Physics discussions', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    organizationAccess.isAssignedToClassSubject.mockResolvedValue(true);

    await expect(
      service.assertCanAccessClassSubject(CLASS_A, PHYSICS_CS, jwt({ id: 'physics-teacher', role: RolesEnum.TEACHER })),
    ).resolves.toMatchObject({ classSubject: { id: PHYSICS_CS } });
  });

  it('14. Conversation participant who is the assigned teacher can access the private thread', async () => {
    classSubjectRepo.findOne.mockResolvedValue(physicsSubject);
    organizationAccess.isAssignedToClassSubject.mockResolvedValue(true);
    conversationRepo.findOne.mockResolvedValue({
      id: CONV_PHYSICS,
      class_id: CLASS_A,
      class_subject_id: PHYSICS_CS,
      student_id: 'student-a',
      teacher_id: 'physics-teacher',
      is_active: ActiveStatusEnum.ACTIVE,
    });

    await expect(
      service.assertCanAccessConversation(
        CLASS_A,
        PHYSICS_CS,
        CONV_PHYSICS,
        jwt({ id: 'physics-teacher', role: RolesEnum.TEACHER }),
      ),
    ).resolves.toMatchObject({ conversation: { id: CONV_PHYSICS } });
  });
});
