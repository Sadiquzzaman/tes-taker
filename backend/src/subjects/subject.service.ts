import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    if (await this.subjectRepo.findOne({ where: { name } })) {
      throw new ConflictException('A subject with this name already exists');
    }
    if (dto.code?.trim()) {
      if (await this.subjectRepo.findOne({ where: { code: dto.code.trim() } })) {
        throw new ConflictException('A subject with this code already exists');
      }
    }
    const entity = this.subjectRepo.create({
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });
    return this.subjectRepo.save(entity);
  }

  async findAll(): Promise<SubjectEntity[]> {
    return this.subjectRepo.find({
      where: {},
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<SubjectEntity> {
    const s = await this.subjectRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Subject not found');
    return s;
  }

  async update(id: string, dto: UpdateSubjectDto, jwtPayload: JwtPayloadInterface): Promise<SubjectEntity> {
    const subject = await this.findOne(id);
    if (dto.name !== undefined) {
      const dup = await this.subjectRepo.findOne({ where: { name: dto.name.trim() } });
      if (dup && dup.id !== id) throw new ConflictException('A subject with this name already exists');
      subject.name = dto.name.trim();
    }
    if (dto.code !== undefined) {
      const c = dto.code === null || dto.code === '' ? null : dto.code.trim();
      if (c) {
        const dup = await this.subjectRepo.findOne({ where: { code: c } });
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
