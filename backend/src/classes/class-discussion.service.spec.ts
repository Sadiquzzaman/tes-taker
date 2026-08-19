import { NotFoundException } from '@nestjs/common';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { ClassDiscussionService } from './class-discussion.service';

const CLASS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PHYSICS_CS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CHEMISTRY_CS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const POST_CHEM = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const CONV_CHEM = '99999999-9999-4999-8999-999999999999';

const physicsJwt: JwtPayloadInterface = {
  id: 'physics-teacher',
  email: 'p@school.test',
  full_name: 'Physics Teacher',
  role: RolesEnum.TEACHER,
  phone: '000',
  session_mode: 'organization',
  organization_id: 'org-1',
};

const physicsSubject = {
  id: PHYSICS_CS,
  class_id: CLASS_A,
  subject_id: 'sub-phy',
  subject: { id: 'sub-phy', name: 'Physics', code: 'PHY' },
};

describe('ClassDiscussionService IDOR scoping', () => {
  let service: ClassDiscussionService;
  let postRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock; create: jest.Mock; save: jest.Mock };
  let conversationRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock; create: jest.Mock; save: jest.Mock };
  let discussionAccess: {
    assertCanAccessClassSubject: jest.Mock;
    assertCanAccessConversation: jest.Mock;
    assertJoinedStudent: jest.Mock;
  };
  let organizationAccess: { isAssignedToClassSubject: jest.Mock };

  beforeEach(() => {
    postRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn(), create: jest.fn(), save: jest.fn() };
    conversationRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn(), create: jest.fn(), save: jest.fn() };
    discussionAccess = {
      assertCanAccessClassSubject: jest.fn().mockResolvedValue({
        classEntity: { id: CLASS_A, organization_id: 'org-1', teacher_id: 'owner' },
        classSubject: physicsSubject,
      }),
      assertCanAccessConversation: jest.fn(),
      assertJoinedStudent: jest.fn().mockResolvedValue(undefined),
    };
    organizationAccess = { isAssignedToClassSubject: jest.fn().mockResolvedValue(true) };

    service = new ClassDiscussionService(
      {} as never,
      postRepo as never,
      { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() } as never,
      conversationRepo as never,
      { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() } as never,
      discussionAccess as never,
      organizationAccess as never,
    );
  });

  it('rejects a postId that belongs to another class subject', async () => {
    postRepo.findOne.mockResolvedValue({
      id: POST_CHEM,
      class_id: CLASS_A,
      class_subject_id: CHEMISTRY_CS,
      is_active: ActiveStatusEnum.ACTIVE,
      author: { id: 'x', full_name: 'X' },
      content: 'secret chemistry',
    });

    await expect(service.getPost(CLASS_A, PHYSICS_CS, POST_CHEM, physicsJwt)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the existing unique private conversation instead of creating a duplicate', async () => {
    conversationRepo.findOne.mockResolvedValue({
      id: CONV_CHEM,
      class_subject_id: PHYSICS_CS,
      student_id: 'student-a',
      teacher_id: 'physics-teacher',
      is_active: ActiveStatusEnum.ACTIVE,
      student: { id: 'student-a', full_name: 'Ada' },
      teacher: { id: 'physics-teacher', full_name: 'Physics Teacher' },
    });

    const result = await service.createConversation(CLASS_A, PHYSICS_CS, physicsJwt, {
      student_id: 'student-a',
    });

    expect(conversationRepo.create).not.toHaveBeenCalled();
    expect(result.id).toBe(CONV_CHEM);
  });
});
