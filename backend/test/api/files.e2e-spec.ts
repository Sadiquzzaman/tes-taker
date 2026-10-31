import { getQueueToken } from '@nestjs/bullmq';
import { getModelToken } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import * as sharpModule from 'sharp';
import { DeepPartial, Repository } from 'typeorm';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { DiscussionPost } from '../../src/chat-mongo/schemas/discussion-post.schema';
import { ExamQuestionEntity } from '../../src/exams/entities/exam-question.entity';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FilesService } from '../../src/files/files.service';
import { LegacyFilesService, parseLegacyKey } from '../../src/files/legacy-files.service';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { FILES_QUEUE } from '../../src/queue/queue.constants';
import { StorageService } from '../../src/storage/storage.service';
import { FeatureOverrideEntity } from '../../src/subscriptions/entities/feature-override.entity';
import { EntitlementsService } from '../../src/subscriptions/entitlements.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

const sharp = sharpModule as unknown as typeof sharpModule.default;

type FileView = {
  id: string;
  purpose: string;
  status: string;
  mime: string;
  name: string | null;
  size_bytes: number;
  original_size_bytes: number | null;
  width: number | null;
  height: number | null;
  url: string;
};
type Usage = {
  used_bytes: number;
  limit_bytes: number;
  percent: number;
  warning: boolean;
  full: boolean;
  by_type: Record<string, number>;
};
type Presigned = { file: FileView; upload: { url: string; method: string; headers: Record<string, string> }; storage: Usage };
type ErrorBody = { code?: string; limit?: string; message?: string };

/**
 * Stored files (P2-07, FND-15, FND-16, design §8.5) on the local driver: presign → PUT → complete
 * → files.process in the worker, the storage quota from the plan, soft delete, tenancy, and the
 * M4 move of old /uploads files.
 */
describe('files', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let files: Repository<FileObjectEntity>;
  let service: FilesService;
  let storage: StorageService;
  let origin: string;

  const MB = 1024 * 1024;

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  /** A school whose plan allows `storageMb` (an override, like Admin → Organisations). */
  const schoolWith = async (storageMb: number) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    await t.dataSource
      .getRepository(FeatureOverrideEntity)
      .save({ organization_id: school.id, key: 'max_storage_mb', value: storageMb } as DeepPartial<FeatureOverrideEntity>);
    await t.app.get(EntitlementsService).invalidate(school.id);
    return { owner, school, token: orgToken(owner, school) };
  };

  const photo = (width = 2400, height = 1800) =>
    sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } })
      .jpeg({ quality: 95 })
      .toBuffer();

  const presign = (token: string, body: Record<string, unknown>) => t.api.post<{ payload: Presigned } & ErrorBody>('/files/presign', body, token);

  /** PUT to the signed link (it names the configured BACKEND_BASE_URL; the test app listens elsewhere). */
  const putTo = (upload: Presigned['upload'], body: Buffer) => {
    const link = new URL(upload.url);
    return fetch(`${origin}${link.pathname}${link.search}`, { method: 'PUT', headers: upload.headers, body: new Uint8Array(body) });
  };

  /** presign → PUT → complete, as the web app does. */
  const upload = async (token: string, body: Buffer, request: Record<string, unknown>) => {
    const signed = await presign(token, { size: body.byteLength, ...request });
    expect(signed.status).toBe(201);
    expect((await putTo(signed.body.payload.upload, body)).status).toBe(204);
    const completed = await t.api.post<{ payload: FileView }>(`/files/${signed.body.payload.file.id}/complete`, {}, token);
    expect(completed.status).toBe(201);
    return completed.body.payload;
  };

  const contentLocation = async (fileId: string) => {
    const response = await fetch(`${origin}/api/v1/files/${fileId}/content`, { redirect: 'manual' });
    return { status: response.status, location: response.headers.get('location') };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    files = t.dataSource.getRepository(FileObjectEntity);
    service = t.app.get(FilesService);
    storage = t.app.get(StorageService);
    origin = (await t.app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await t.close();
  });

  describe('upload and compression (FND-15)', () => {
    it('uploads a photo, compresses it to WebP in files.process and serves it through a signed link', async () => {
      const teacher = await make.teacher();
      const token = t.tokenFor(teacher);
      const original = await photo();

      const signed = await presign(token, { purpose: 'EXAM', mime: 'image/jpeg', size: original.byteLength, name: 'board.jpg' });
      expect(signed.status).toBe(201);
      expect(signed.body.payload.file).toMatchObject({ status: 'PENDING', purpose: 'EXAM', name: 'board.jpg' });
      expect(signed.body.payload.upload).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } });

      const fileId = signed.body.payload.file.id;
      // Not uploaded yet: nothing to serve, and completing is refused.
      expect((await contentLocation(fileId)).status).toBe(404);
      expect((await t.api.post(`/files/${fileId}/complete`, {}, token)).status).toBe(400);

      expect((await putTo(signed.body.payload.upload, original)).status).toBe(204);
      const completed = await t.api.post<{ payload: FileView }>(`/files/${fileId}/complete`, {}, token);
      expect(completed.status).toBe(201);
      expect(completed.body.payload).toMatchObject({ status: 'PENDING', original_size_bytes: original.byteLength });
      expect(completed.body.payload.url).toMatch(new RegExp(`/api/v1/files/${fileId}/content$`));

      // Compression is a worker job, queued once per file.
      const job = await t.app.get<Queue>(getQueueToken(FILES_QUEUE)).getJob(`process-${fileId}`);
      expect(job?.data).toEqual({ fileId });
      // While it waits, the upload itself is served.
      expect((await contentLocation(fileId)).location).toContain('/uploads/tmp/');

      await expect(service.process(fileId)).resolves.toMatchObject({ status: 'READY' });
      await expect(service.process(fileId)).resolves.toMatchObject({ status: 'skipped' });

      const view = await t.api.get<{ payload: FileView }>(`/files/${fileId}`, token);
      expect(view.body.payload).toMatchObject({ status: 'READY', mime: 'image/webp', width: 1600, height: 1200 });
      expect(view.body.payload.size_bytes).toBeLessThan(original.byteLength);

      const row = await files.findOneByOrFail({ id: fileId });
      const year = new Date(row.created_at).getUTCFullYear();
      expect(row.s3_key).toBe(`org/${row.organization_id}/exam/${year}/${fileId}.webp`);
      expect(await storage.head(row.s3_key)).toEqual({ size: row.size_bytes });

      const content = await contentLocation(fileId);
      expect(content.status).toBe(302);
      expect(content.location).toContain(`/uploads/${row.s3_key}`);

      const audit = await t.dataSource.getRepository(AuditLogEntity).findOneByOrFail({ action: 'file.upload', entity_id: fileId });
      expect(audit).toMatchObject({ actor_id: teacher.id, organization_id: row.organization_id });
    });

    it('stores documents as they are', async () => {
      const teacher = await make.teacher();
      const classEntity = await make.classOf(teacher);
      const pdf = Buffer.from('%PDF-1.4\n% test document\n');
      const file = await upload(t.tokenFor(teacher), pdf, { purpose: 'DISCUSSION', mime: 'application/pdf', scope_id: classEntity.id, name: 'notes.pdf' });

      await service.process(file.id);
      const row = await files.findOneByOrFail({ id: file.id });
      expect(row).toMatchObject({ status: 'READY', mime: 'application/pdf', size_bytes: pdf.byteLength, organization_id: classEntity.organization_id });
      expect(row.s3_key).toMatch(/\/discussion\/\d{4}\/.+\.pdf$/);
    });

    it('refuses other types, files over 20 MB, unknown purposes and forged upload links', async () => {
      const token = t.tokenFor(await make.teacher());

      expect((await presign(token, { purpose: 'EXAM', mime: 'application/pdf', size: 1000 })).status).toBe(400);
      expect((await presign(token, { purpose: 'EXAM', mime: 'image/heic', size: 1000 })).status).toBe(400);
      expect((await presign(token, { purpose: 'EXAM', mime: 'image/png', size: 20 * MB + 1 })).status).toBe(400);
      expect((await presign(token, { purpose: 'VIDEO', mime: 'image/png', size: 1000 })).status).toBe(400);

      const signed = await presign(token, { purpose: 'EXAM', mime: 'image/png', size: 1000 });
      const forged = { ...signed.body.payload.upload, url: signed.body.payload.upload.url.replace(/signature=[0-9a-f]+/, 'signature=00') };
      expect((await putTo(forged, Buffer.alloc(10))).status).toBe(403);
    });

    it('refuses a file larger than declared and frees its space', async () => {
      const token = t.tokenFor(await make.teacher());
      const signed = await presign(token, { purpose: 'EXAM', mime: 'image/png', size: 10 });
      await putTo(signed.body.payload.upload, Buffer.alloc(5000));

      expect((await t.api.post(`/files/${signed.body.payload.file.id}/complete`, {}, token)).status).toBe(413);
      expect(await files.findOneByOrFail({ id: signed.body.payload.file.id })).toMatchObject({ status: 'FAILED' });
    });

    it('keeps the older multipart endpoint working through the same flow', async () => {
      const teacher = await make.teacher();
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(await photo(400, 300))], { type: 'image/jpeg' }), 'q1.jpg');

      const response = await fetch(`${origin}/api/v1/uploads/media?purpose=exam&scopeId=draft`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t.tokenFor(teacher)}` },
        body: form,
      });
      const body = (await response.json()) as { payload: { id: string; url: string; kind: string; status: string } };

      expect(response.status).toBe(201);
      expect(body.payload).toMatchObject({ kind: 'image', status: 'PENDING' });
      expect(body.payload.url).toMatch(/\/api\/v1\/files\/[0-9a-f-]+\/content$/);
      expect(await files.findOneByOrFail({ id: body.payload.id })).toMatchObject({ owner_id: teacher.id, purpose: 'EXAM' });
      expect(await t.app.get<Queue>(getQueueToken(FILES_QUEUE)).getJob(`process-${body.payload.id}`)).toBeDefined();
    });
  });

  describe('storage quota (FND-16)', () => {
    it('warns at 90%, blocks at 100% with PLAN_LIMIT_REACHED, and a soft delete frees the space', async () => {
      const { owner, school, token } = await schoolWith(1);

      const first = await presign(token, { purpose: 'EXAM', mime: 'image/png', size: Math.ceil(0.95 * MB), name: 'big.png' });
      expect(first.status).toBe(201);
      expect(first.body.payload.storage).toMatchObject({ limit_bytes: MB, warning: true, full: false, percent: 95 });

      const refused = await presign(token, { purpose: 'EXAM', mime: 'image/png', size: Math.ceil(0.1 * MB) });
      expect(refused.status).toBe(403);
      expect(refused.body).toMatchObject({ code: 'PLAN_LIMIT_REACHED', limit: 'max_storage_mb' });

      const removed = await t.api.request('DELETE', `/files/${first.body.payload.file.id}`, { token });
      expect(removed.status).toBe(200);
      const row = await files.findOneByOrFail({ id: first.body.payload.file.id });
      expect(row.deleted_at).not.toBeNull();
      expect(row.deleted_by).toBe(owner.id);
      expect(await t.dataSource.getRepository(AuditLogEntity).countBy({ action: 'file.delete', entity_id: row.id })).toBe(1);

      expect((await presign(token, { purpose: 'EXAM', mime: 'image/png', size: Math.ceil(0.1 * MB) })).status).toBe(201);
      expect((await t.api.get<{ payload: Usage }>('/files/usage', token)).body.payload.used_bytes).toBe(Math.ceil(0.1 * MB));
      expect(school.id).toBeDefined();
    });

    it('shows the owner storage used by type; other members cannot see it', async () => {
      const { school, token } = await schoolWith(10);
      await t.dataSource.getRepository(FileObjectEntity).save([
        { organization_id: school.id, purpose: 'HOMEWORK', s3_key: 'k1', mime: 'application/pdf', size_bytes: 3000, status: 'READY' },
        { organization_id: school.id, purpose: 'RESOURCE', s3_key: 'k2', mime: 'application/pdf', size_bytes: 2000, status: 'READY' },
        { organization_id: school.id, purpose: 'EXAM', s3_key: 'k3', mime: 'image/webp', size_bytes: 1000, status: 'PENDING' },
        { organization_id: school.id, purpose: 'EXAM', s3_key: 'k4', mime: 'image/webp', size_bytes: 9000, status: 'FAILED' },
        { organization_id: school.id, purpose: 'EXAM', s3_key: 'k5', mime: 'image/webp', size_bytes: 7000, status: 'READY', deleted_at: new Date() },
      ] as DeepPartial<FileObjectEntity>[]);

      const usage = await t.api.get<{ payload: Usage }>('/files/usage', token);
      expect(usage.status).toBe(200);
      expect(usage.body.payload).toMatchObject({
        used_bytes: 6000,
        limit_bytes: 10 * MB,
        warning: false,
        by_type: { homework: 3000, resources: 2000, video: 0, other: 1000 },
      });

      const teacher = await make.teacher({ personal_teacher_enabled: false });
      await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
      expect((await t.api.get('/files/usage', orgToken(teacher, school, OrganizationMemberRoleEnum.TEACHER))).status).toBe(403);
    });

    it('frees links that were never completed after 24 hours', async () => {
      const token = t.tokenFor(await make.teacher());
      const signed = await presign(token, { purpose: 'EXAM', mime: 'image/png', size: 1000 });
      await files.update({ id: signed.body.payload.file.id }, { created_at: new Date(Date.now() - 25 * 60 * 60 * 1000) });

      const swept = await service.sweep();
      expect(swept.abandoned).toBeGreaterThanOrEqual(1);
      expect(await files.findOneByOrFail({ id: signed.body.payload.file.id })).toMatchObject({ status: 'FAILED' });
    });
  });

  describe('tenancy', () => {
    it("returns 404 for another organisation's file", async () => {
      const a = await schoolWith(10);
      const b = await schoolWith(10);
      const file = await upload(a.token, await photo(200, 200), { purpose: 'EXAM', mime: 'image/jpeg' });

      expect((await t.api.get(`/files/${file.id}`, a.token)).status).toBe(200);
      expect((await t.api.get(`/files/${file.id}`, b.token)).status).toBe(404);
      expect((await t.api.request('DELETE', `/files/${file.id}`, { token: b.token })).status).toBe(404);
      expect((await t.api.post(`/files/${file.id}/complete`, {}, b.token)).status).toBe(404);
    });

    it("puts a student's discussion file in the class's organisation; students outside the class are refused", async () => {
      const teacher = await make.teacher();
      const classEntity = await make.classOf(teacher);
      const student = await make.student();
      await make.enrol(classEntity, student);
      const body = { purpose: 'DISCUSSION', mime: 'image/png', size: 1000, scope_id: classEntity.id };

      const allowed = await presign(t.tokenFor(student), body);
      expect(allowed.status).toBe(201);
      expect(await files.findOneByOrFail({ id: allowed.body.payload.file.id })).toMatchObject({
        organization_id: classEntity.organization_id,
        owner_id: student.id,
      });

      expect((await presign(t.tokenFor(await make.student()), body)).status).toBe(403);
      expect((await presign(t.tokenFor(student), { ...body, scope_id: undefined })).status).toBe(400);
    });
  });

  describe('moving old /uploads files (M4)', () => {
    it('parses the three kinds of old links', () => {
      expect(parseLegacyKey('/uploads/exams/draft/a-b.png')).toBe('exams/draft/a-b.png');
      expect(parseLegacyKey('http://localhost:4000/uploads/discussions/c1/x.pdf')).toBe('discussions/c1/x.pdf');
      expect(parseLegacyKey('https://bucket.s3.ap-southeast-1.amazonaws.com/exams/e1/p%20q.jpg')).toBe('exams/e1/p q.jpg');
      expect(parseLegacyKey('https://api.example/api/v1/uploads/content?key=images%2Fg%2Fz.png')).toBe('images/g/z.png');
      expect(parseLegacyKey('https://cdn.example/other.png')).toBeNull();
      expect(parseLegacyKey('/uploads/../etc/passwd')).toBeNull();
      expect(parseLegacyKey(`/api/v1/files/${randomUUID()}/content`)).toBeNull();
    });

    it('copies old files, rewrites links in questions and discussion posts, and is safe to run again', async () => {
      const teacher = await make.teacher();
      const exam = await make.openExam(teacher);
      const run = randomUUID();
      const questionKey = `exams/${run}/${randomUUID()}-diagram.png`;
      const optionKey = `exams/${run}/${randomUUID()}-option.png`;
      const attachmentKey = `discussions/${run}/${randomUUID()}-notes.pdf`;
      await storage.put({ key: questionKey, body: Buffer.from('question-image'), contentType: 'image/png' });
      await storage.put({ key: optionKey, body: Buffer.from('option-image'), contentType: 'image/png' });
      await storage.put({ key: attachmentKey, body: Buffer.from('%PDF'), contentType: 'application/pdf' });

      const questions = t.dataSource.getRepository(ExamQuestionEntity);
      const question = await questions.save({
        exam: { id: exam.id },
        question: 'Which shape?',
        image_url: `/uploads/${questionKey}`,
        options_json: [
          { id: 'a', text: 'A', image: `https://api.example/api/v1/uploads/content?key=${encodeURIComponent(optionKey)}` },
          { id: 'b', text: 'B', image: `/uploads/exams/${run}/gone.png` },
        ],
      } as DeepPartial<ExamQuestionEntity>);

      const classEntity = await make.classOf(teacher);
      const posts = t.app.get<Model<DiscussionPost>>(getModelToken(DiscussionPost.name));
      const post = await posts.create({
        classId: classEntity.id,
        classSubjectId: randomUUID(),
        subjectId: randomUUID(),
        authorId: teacher.id,
        content: 'Notes',
        attachments: [{ id: 'att1', key: attachmentKey, url: `/uploads/${attachmentKey}`, file_name: 'notes.pdf', mime_type: 'application/pdf', size: 4, kind: 'file' }],
      });
      const legacy = t.app.get(LegacyFilesService);

      const dry = await legacy.run({ apply: false });
      expect(dry.exam_questions).toMatchObject({ found: 3, copied: 2, missing: 1, rewritten: 0 });
      expect(dry.discussion_posts).toMatchObject({ found: 1, copied: 1, rewritten: 0 });
      expect(await files.countBy({ legacy_key: questionKey })).toBe(0);
      expect((await questions.findOneByOrFail({ id: question.id })).image_url).toBe(`/uploads/${questionKey}`);

      const applied = await legacy.run({ apply: true });
      expect(applied.exam_questions).toMatchObject({ copied: 2, missing: 1, rewritten: 1 });
      expect(applied.discussion_posts).toMatchObject({ copied: 1, rewritten: 1 });

      const moved = await files.findOneByOrFail({ legacy_key: questionKey });
      expect(moved).toMatchObject({ organization_id: exam.organization_id, purpose: 'EXAM', status: 'READY', size_bytes: 14 });
      expect(moved.s3_key).toBe(`org/${exam.organization_id}/legacy/${questionKey}`);
      expect(await storage.head(moved.s3_key)).not.toBeNull();
      // Old files are never deleted.
      expect(await storage.head(questionKey)).not.toBeNull();

      const after = await questions.findOneByOrFail({ id: question.id });
      expect(after.image_url).toBe(service.contentUrl(moved.id));
      expect(after.options_json?.[0].image).toBe(service.contentUrl((await files.findOneByOrFail({ legacy_key: optionKey })).id));
      expect(after.options_json?.[1].image).toBe(`/uploads/exams/${run}/gone.png`);

      const movedAttachment = await files.findOneByOrFail({ legacy_key: attachmentKey });
      expect(movedAttachment.organization_id).toBe(classEntity.organization_id);
      const updatedPost = await posts.findById(post._id).lean();
      expect(updatedPost?.attachments[0]).toMatchObject({ key: movedAttachment.id, url: service.contentUrl(movedAttachment.id), file_name: 'notes.pdf' });

      const again = await legacy.run({ apply: true });
      expect(again.exam_questions).toMatchObject({ copied: 0, rewritten: 0, missing: 1 });
      expect(again.discussion_posts).toMatchObject({ found: 0, rewritten: 0 });
      expect(await files.countBy({ legacy_key: questionKey })).toBe(1);
    });
  });
});
