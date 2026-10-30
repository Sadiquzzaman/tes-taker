import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { isUniqueViolation } from 'src/common/utils/db-error.util';
import { UserService } from 'src/user/user.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { TeacherRoleRequestEntity } from './entities/teacher-role-request.entity';
import { TeacherRequestStatusEnum } from './enums/teacher-request-status.enum';
import { ListTeacherRequestsQueryDto } from './dto/list-teacher-requests-query.dto';

@Injectable()
export class TeacherRequestService {
  constructor(
    @InjectRepository(TeacherRoleRequestEntity)
    private readonly requestRepo: Repository<TeacherRoleRequestEntity>,
    private readonly userService: UserService,
    private readonly audit: AuditService,
  ) {}

  async getMyRequest(userId: string) {
    const request = await this.requestRepo.findOne({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    return request
      ? this.toStudentView(request)
      : null;
  }

  async createRequest(userId: string, options?: { note?: string }) {
    const user = await this.userService.findById(userId);

    if (user.role !== RolesEnum.STUDENT) {
      throw new BadRequestException('Only students can request to become a teacher');
    }

    const pending = await this.requestRepo.findOne({
      where: {
        user_id: userId,
        status: TeacherRequestStatusEnum.PENDING,
      },
    });

    if (pending) {
      throw new BadRequestException('You already have a pending teacher request');
    }

    const request = this.requestRepo.create({
      user_id: userId,
      status: TeacherRequestStatusEnum.PENDING,
      note: options?.note?.trim() || null,
      created_by: userId,
      created_user_name: user.full_name,
      created_at: new Date(),
    });

    try {
      const saved = await this.requestRepo.save(request);
      return this.toStudentView(saved);
    } catch (error) {
      // A parallel request won the race past the check above.
      if (isUniqueViolation(error, 'UQ_teacher_role_requests_pending_user')) {
        throw new BadRequestException('You already have a pending teacher request');
      }
      throw error;
    }
  }

  async listForAdmin(query: ListTeacherRequestsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const search = query.search?.trim();

    const qb = this.requestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .orderBy('request.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    if (search) {
      const term = `%${search}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('user.full_name ILIKE :term', { term })
            .orWhere('user.email ILIKE :term', { term })
            .orWhere('user.phone ILIKE :term', { term });
        }),
      );
    }

    const [requests, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      requests: requests.map((request) => this.toAdminView(request)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async approve(adminId: string, requestId: string, note?: string) {
    const request = await this.findPendingOrThrow(requestId);

    await this.userService.updateUserRole(adminId, request.user_id, RolesEnum.TEACHER);

    request.status = TeacherRequestStatusEnum.APPROVED;
    request.reviewed_by = adminId;
    request.reviewed_at = new Date();
    request.note = note?.trim() || null;
    request.updated_by = adminId;
    request.updated_at = new Date();

    const saved = await this.requestRepo.save(request);
    this.recordReview(AUDIT_ACTIONS.TEACHER_REQUEST_APPROVE, adminId, saved);
    const withUser = await this.requestRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    return this.toAdminView(withUser ?? saved);
  }

  async reject(adminId: string, requestId: string, note?: string) {
    const request = await this.findPendingOrThrow(requestId);

    request.status = TeacherRequestStatusEnum.REJECTED;
    request.reviewed_by = adminId;
    request.reviewed_at = new Date();
    request.note = note?.trim() || null;
    request.updated_by = adminId;
    request.updated_at = new Date();

    const saved = await this.requestRepo.save(request);
    this.recordReview(AUDIT_ACTIONS.TEACHER_REQUEST_REJECT, adminId, saved);
    const withUser = await this.requestRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    return this.toAdminView(withUser ?? saved);
  }

  private recordReview(
    action: typeof AUDIT_ACTIONS.TEACHER_REQUEST_APPROVE | typeof AUDIT_ACTIONS.TEACHER_REQUEST_REJECT,
    adminId: string,
    request: TeacherRoleRequestEntity,
  ): void {
    this.audit.record({
      action,
      actorId: adminId,
      entityType: 'teacher_role_request',
      entityId: request.id,
      before: { status: TeacherRequestStatusEnum.PENDING },
      after: { status: request.status, user_id: request.user_id },
      reason: request.note,
    });
  }

  private async findPendingOrThrow(requestId: string): Promise<TeacherRoleRequestEntity> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException('Teacher request not found');
    }

    if (request.status !== TeacherRequestStatusEnum.PENDING) {
      throw new BadRequestException('Only pending requests can be reviewed');
    }

    return request;
  }

  private toStudentView(request: TeacherRoleRequestEntity) {
    return {
      id: request.id,
      status: request.status,
      note: request.note,
      created_at: request.created_at,
      reviewed_at: request.reviewed_at,
    };
  }

  private toAdminView(request: TeacherRoleRequestEntity) {
    const user = request.user as UserEntity | undefined;
    return {
      id: request.id,
      status: request.status,
      note: request.note,
      created_at: request.created_at,
      reviewed_at: request.reviewed_at,
      reviewed_by: request.reviewed_by,
      user: {
        id: request.user_id,
        full_name: user?.full_name ?? null,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        role: user?.role ?? null,
      },
    };
  }
}
