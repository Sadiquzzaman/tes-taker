import { NotFoundException } from '@nestjs/common';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { ClassDiscussionService } from './class-discussion.service';

const CLASS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PHYSICS_CS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CHEMISTRY_CS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const POST_CHEM = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const CONV_PHYS = '99999999-9999-4999-8999-999999999999';

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

const leanExec = <T>(value: T) => ({
  lean: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(value),
  }),
  exec: jest.fn().mockResolvedValue(value),
});

describe('ClassDiscussionService Mongo IDOR scoping', () => {
  let service: ClassDiscussionService;
  let postModel: {
    findById: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    countDocuments: jest.Mock;
    aggregate: jest.Mock;
  };
  let conversationModel: { findOne: jest.Mock; findById: jest.Mock; create: jest.Mock };
  let discussionAccess: {
    assertCanAccessClassSubject: jest.Mock;
    assertCanAccessConversation: jest.Mock;
    assertJoinedStudent: jest.Mock;
  };
  let organizationAccess: { isAssignedToClassSubject: jest.Mock };

  beforeEach(() => {
    postModel = {
      findById: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };
    conversationModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
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
      { find: jest.fn().mockResolvedValue([]) } as never,
      postModel as never,
      {
        find: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        countDocuments: jest.fn(),
        aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      } as never,
      conversationModel as never,
      { find: jest.fn(), create: jest.fn(), countDocuments: jest.fn() } as never,
      discussionAccess as never,
      organizationAccess as never,
    );
  });

  it('rejects a postId that belongs to another class subject', async () => {
    postModel.findById.mockReturnValue(
      leanExec({
        _id: POST_CHEM,
        classId: CLASS_A,
        classSubjectId: CHEMISTRY_CS,
        isActive: true,
        authorId: 'x',
        content: 'secret chemistry',
      }),
    );

    await expect(service.getPost(CLASS_A, PHYSICS_CS, POST_CHEM, physicsJwt)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the existing unique private conversation instead of creating a duplicate', async () => {
    conversationModel.findOne.mockReturnValue(
      leanExec({
        _id: CONV_PHYS,
        classSubjectId: PHYSICS_CS,
        studentId: 'student-a',
        teacherId: 'physics-teacher',
        isActive: true,
      }),
    );

    const result = await service.createConversation(CLASS_A, PHYSICS_CS, physicsJwt, {
      student_id: 'student-a',
    });

    expect(conversationModel.create).not.toHaveBeenCalled();
    expect(result.id).toBe(CONV_PHYS);
  });

  it('paginates public posts with skip/limit rather than loading the full collection', async () => {
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    postModel.find.mockReturnValue(chain);
    postModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(40) });

    const result = await service.listPosts(CLASS_A, PHYSICS_CS, physicsJwt, 2, 10);

    expect(postModel.find).toHaveBeenCalledWith({
      classId: CLASS_A,
      classSubjectId: PHYSICS_CS,
      isActive: true,
    });
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 40, total_pages: 4 });
  });
});
