import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { Conversion, convertExam, OldQuestion, OldSection } from './convert';
import { IeltsModuleEnum, IeltsTestTypeEnum } from './entities/ielts-profile.entity';
import { IeltsQuestionGroupEntity } from './entities/ielts-question-group.entity';
import { IeltsQuestionEntity } from './entities/ielts-question.entity';
import { IeltsTestEntity, IeltsTestPurposeEnum, IeltsTestStatusEnum } from './entities/ielts-test.entity';
import { IeltsTestPartEntity } from './entities/ielts-test-part.entity';
import { IELTS_ERRORS } from './ielts-errors';
import { IeltsProfilesService } from './ielts-profiles.service';
import { MOCK_DURATIONS, PART_COUNT, practiceDuration } from './ielts-templates';
import { cleanAnswer } from './question-groups';

export interface IeltsOldExam {
  id: string;
  title: string;
  created_at: Date;
  /** The new test copied from it, if any. */
  converted_test_id: string | null;
}

/**
 * Copying IELTS exams made in the academic builder into the new format (P10-08, Epic 11
 * decision): the old exam stays as it is; the copy is a draft marked "Converted — check before
 * use" (`needs_review`, `source_exam_id`). Questions that do not fit are listed, not copied.
 */
@Injectable()
export class IeltsConvertService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly profiles: IeltsProfilesService,
    private readonly audit: AuditService,
  ) {}

  /** Staff: the centre's academic-builder IELTS exams and whether each was copied. */
  async list(tenant: Tenant): Promise<IeltsOldExam[]> {
    await this.assertStaff(tenant);
    return this.dataSource.query(
      `SELECT e.id, COALESCE(NULLIF(trim(e.test_name), ''), 'IELTS test') AS title, e.created_at,
              (SELECT t.id FROM ielts_tests t WHERE t.source_exam_id = e.id AND t.deleted_at IS NULL ORDER BY t.created_at LIMIT 1) AS converted_test_id
         FROM exams e
        WHERE e.organization_id = $1 AND e.exam_category = 'ielts'
        ORDER BY e.created_at DESC`,
      [tenant.organizationId],
    );
  }

  /** Staff: copy one into a draft IELTS test (audited). */
  async convert(tenant: Tenant, userId: string, examId: string): Promise<{ test_id: string; converted: number; skipped: Conversion['skipped'] }> {
    await this.assertStaff(tenant);
    const [exam]: { id: string; title: string; converted_test_id: string | null }[] = await this.dataSource.query(
      `SELECT e.id, COALESCE(NULLIF(trim(e.test_name), ''), 'IELTS test') AS title,
              (SELECT t.id FROM ielts_tests t WHERE t.source_exam_id = e.id AND t.deleted_at IS NULL LIMIT 1) AS converted_test_id
         FROM exams e WHERE e.id = $1 AND e.organization_id = $2 AND e.exam_category = 'ielts'`,
      [examId, tenant.organizationId],
    );
    if (!exam) throw new NotFoundException({ message: 'IELTS exam not found', code: IELTS_ERRORS.OLD_EXAM_NOT_FOUND });
    if (exam.converted_test_id) {
      throw new ConflictException({ message: 'This exam was copied already', code: IELTS_ERRORS.ALREADY_CONVERTED, details: { test_id: exam.converted_test_id } });
    }
    const questions: OldQuestion[] = await this.dataSource.query(
      `SELECT id, module_key, section_id, parent_id, category, sub_type, sort_order, question, instruction, passage_text, options_json, matching_options_json, answer_json, image_url, audio_url
         FROM exam_questions WHERE exam_id = $1`,
      [exam.id],
    );
    const sections: OldSection[] = await this.dataSource.query(`SELECT id, module_key, header_text, instruction, sort_order FROM exam_question_sections WHERE exam_id = $1`, [exam.id]);
    const result = convertExam(questions, sections);
    if (!result.modules.length) throw new BadRequestException({ message: 'Nothing in this exam fits the IELTS format', code: IELTS_ERRORS.NOTHING_TO_CONVERT });

    const mock = result.modules.length > 1;
    const testId = await this.dataSource.transaction(async (manager) => {
      const test = await manager.getRepository(IeltsTestEntity).save(
        manager.getRepository(IeltsTestEntity).create({
          organization_id: tenant.organizationId,
          title: `${exam.title} (converted)`.slice(0, 200),
          test_type: IeltsTestTypeEnum.ACADEMIC,
          purpose: mock ? IeltsTestPurposeEnum.MOCK : IeltsTestPurposeEnum.PRACTICE,
          modules: result.modules,
          durations: Object.fromEntries(
            result.modules.map((m) => [m, mock ? MOCK_DURATIONS[m] : practiceDuration(m, result.parts.filter((p) => p.module === m).map((p) => p.part_no))]),
          ),
          status: IeltsTestStatusEnum.DRAFT,
          source_exam_id: exam.id,
          needs_review: true,
          created_by: userId,
        }),
      );
      // A mock gets every part of its modules; a practice set the parts the old exam used.
      const wanted: { module: IeltsModuleEnum; part_no: number }[] = mock
        ? result.modules.flatMap((module) => Array.from({ length: PART_COUNT[module] }, (_, i) => ({ module, part_no: i + 1 })))
        : result.parts.map((p) => ({ module: p.module, part_no: p.part_no }));
      for (const w of wanted) {
        const source = result.parts.find((p) => p.module === w.module && p.part_no === w.part_no);
        const part = await manager.getRepository(IeltsTestPartEntity).save(
          manager.getRepository(IeltsTestPartEntity).create({ test_id: test.id, module: w.module, part_no: w.part_no, content: source?.content ?? null }),
        );
        for (const [i, g] of (source?.groups ?? []).entries()) {
          const group = await manager.getRepository(IeltsQuestionGroupEntity).save(
            manager.getRepository(IeltsQuestionGroupEntity).create({
              part_id: part.id,
              type: g.type,
              instruction: g.instruction,
              word_limit: g.word_limit ?? null,
              shared: g.shared ?? null,
              sort_order: i + 1,
            }),
          );
          await manager.getRepository(IeltsQuestionEntity).save(
            g.questions.map((q, j) =>
              manager.getRepository(IeltsQuestionEntity).create({ group_id: group.id, sort_order: j + 1, prompt: q.prompt ?? null, options: q.options ?? null, answer: cleanAnswer(q.answer) }),
            ),
          );
        }
      }
      return test.id;
    });
    this.audit.record({
      action: AUDIT_ACTIONS.IELTS_CONVERT,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'ielts_test',
      entityId: testId,
      before: null,
      after: { source_exam_id: exam.id, converted: result.converted, skipped: result.skipped.length },
    });
    return { test_id: testId, converted: result.converted, skipped: result.skipped };
  }

  private async assertStaff(tenant: Tenant): Promise<void> {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff can do this', code: IELTS_ERRORS.STAFF_ONLY });
    }
    await this.profiles.assertIeltsCentre(tenant);
  }
}
