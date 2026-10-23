import { RolesEnum } from 'src/common/enums/roles.enum';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ExamService } from './exam.service';

const CLASS_ID = '11111111-1111-4111-8111-111111111111';
const OWN_EXAM = { id: 'exam-own', created_by: 'teacher-a', organization_id: null };
const OTHER_EXAM = { id: 'exam-other', created_by: 'teacher-b', organization_id: null };

// Only examRepo (0) and organizationAccessService (11) are used by findByClass.
function build(canMonitor: (exam: { id: string }) => boolean) {
  const examRepo = { find: jest.fn().mockResolvedValue([OWN_EXAM, OTHER_EXAM]) };
  const organizationAccessService = {
    canMonitorExam: jest.fn(async (exam: { id: string }) => canMonitor(exam)),
  };
  const deps: unknown[] = new Array(14).fill({});
  deps[0] = examRepo;
  deps[11] = organizationAccessService;
  const service = new (ExamService as unknown as new (...args: unknown[]) => ExamService)(...deps);
  const internals = service as unknown as Record<string, jest.Mock>;
  jest.spyOn(internals, 'loadExamListMetrics').mockResolvedValue(new Map());
  jest.spyOn(internals, 'formatExamResponse').mockImplementation((exam: { id: string }) => ({ id: exam.id }));
  return { service, organizationAccessService };
}

const caller = (role: RolesEnum, id = 'teacher-a') => ({ id, role }) as unknown as JwtPayloadInterface;

describe('ExamService.findByClass access', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns only the exams the teacher may open, not every exam of the class', async () => {
    const { service } = build((exam) => exam.id === OWN_EXAM.id);

    const result = await service.findByClass(CLASS_ID, caller(RolesEnum.TEACHER));

    expect((result as unknown as { id: string }[]).map((exam) => exam.id)).toEqual(['exam-own']);
  });

  it('returns nothing to a teacher with no access to the class exams', async () => {
    const { service } = build(() => false);

    await expect(service.findByClass(CLASS_ID, caller(RolesEnum.TEACHER, 'stranger'))).resolves.toEqual([]);
  });

  it('checks access with the caller id and organisation context', async () => {
    const { service, organizationAccessService } = build(() => true);
    const orgContext = { organizationId: 'org-1' } as never;

    await service.findByClass(CLASS_ID, caller(RolesEnum.TEACHER), orgContext);

    expect(organizationAccessService.canMonitorExam).toHaveBeenCalledWith(OWN_EXAM, 'teacher-a', orgContext);
    expect(organizationAccessService.canMonitorExam).toHaveBeenCalledWith(OTHER_EXAM, 'teacher-a', orgContext);
  });

  it('lets admins see every exam of the class without per-exam checks', async () => {
    const { service, organizationAccessService } = build(() => false);

    const result = await service.findByClass(CLASS_ID, caller(RolesEnum.ADMIN, 'admin'));

    expect(result).toHaveLength(2);
    expect(organizationAccessService.canMonitorExam).not.toHaveBeenCalled();
  });
});
