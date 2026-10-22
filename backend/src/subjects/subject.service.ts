import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { SubjectEntity } from './entities/subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';

@Injectable()
export class SubjectService {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
  ) {}

  async create(dto: CreateSubjectDto, jwtPayload: JwtPayloadInterface): Promise<SubjectEntity> {
    const name = dto.name.trim();
    if (await this.subjectRepo.findOne({ where: { name, organization_id: IsNull() } })) {
      throw new ConflictException('A subject with this name already exists');
    }
    if (dto.code?.trim()) {
      if (await this.subjectRepo.findOne({ where: { code: dto.code.trim(), organization_id: IsNull() } })) {
        throw new ConflictException('A subject with this code already exists');
      }
    }
    const entity = this.subjectRepo.create({
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      organization_id: null,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });
    return this.subjectRepo.save(entity);
  }

  async findAll(): Promise<SubjectEntity[]> {
    return this.subjectRepo.find({
      where: { organization_id: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<SubjectEntity> {
    const s = await this.subjectRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Subject not found');
    return s;
  }

  async findOrCreateByName(name: string, jwtPayload: JwtPayloadInterface): Promise<SubjectEntity> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ConflictException('Subject name is required');
    }
    const existing = await this.subjectRepo.findOne({
      where: { name: trimmed, organization_id: IsNull() },
    });
    if (existing) {
      return existing;
    }
    return this.create({ name: trimmed }, jwtPayload);
  }

  async update(id: string, dto: UpdateSubjectDto, jwtPayload: JwtPayloadInterface): Promise<SubjectEntity> {
    const subject = await this.findOne(id);
    if (subject.organization_id) {
      throw new ConflictException('Organization subjects are managed in the organization workspace');
    }
    if (dto.name !== undefined) {
      const dup = await this.subjectRepo.findOne({
        where: { name: dto.name.trim(), organization_id: IsNull() },
      });
      if (dup && dup.id !== id) throw new ConflictException('A subject with this name already exists');
      subject.name = dto.name.trim();
    }
    if (dto.code !== undefined) {
      const c = dto.code === null || dto.code === '' ? null : dto.code.trim();
      if (c) {
        const dup = await this.subjectRepo.findOne({
          where: { code: c, organization_id: IsNull() },
        });
        if (dup && dup.id !== id) throw new ConflictException('A subject with this code already exists');
      }
      subject.code = c;
    }
    subject.updated_by = jwtPayload.id;
    subject.updated_user_name = jwtPayload.full_name;
    subject.updated_at = new Date();
    return this.subjectRepo.save(subject);
  }

  async remove(id: string): Promise<void> {
    const subject = await this.findOne(id);
    if (subject.organization_id) {
      throw new ConflictException('Organization subjects are managed in the organization workspace');
    }
    await this.subjectRepo.remove(subject);
  }

  async assertSubjectsExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const unique = [...new Set(ids)];
    const count = await this.subjectRepo.count({ where: { id: In(unique) } });
    if (count !== unique.length) {
      throw new NotFoundException('One or more subject IDs are invalid');
    }
  }
}
