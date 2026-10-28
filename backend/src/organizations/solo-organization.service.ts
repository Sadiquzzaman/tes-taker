import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationKindEnum } from './enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from './enums/organization-member-role.enum';
import { OrganizationStatusEnum } from './enums/organization-status.enum';

/**
 * A teacher's own workspace (design §8.1): an approved organisation with kind = SOLO and the
 * teacher as OWNER. It replaces the old "personal teacher" mode, where data had no organisation.
 * Migration 1755200000000 created one for existing teachers; new ones are created on first use.
 */
@Injectable()
export class SoloOrganizationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
  ) {}

  /** The teacher's SOLO organisation id, or null if they have none yet. */
  async findIdForOwner(userId: string, manager?: EntityManager): Promise<string | null> {
    const repo = manager ? manager.getRepository(OrganizationMemberEntity) : this.memberRepo;
    const row = await repo
      .createQueryBuilder('member')
      .innerJoin('member.organization', 'organization')
      .select('member.organization_id', 'organization_id')
      .where('member.user_id = :userId', { userId })
      .andWhere('member.role = :owner', { owner: OrganizationMemberRoleEnum.OWNER })
      .andWhere('organization.kind = :solo', { solo: OrganizationKindEnum.SOLO })
      .getRawOne<{ organization_id: string }>();
    return row?.organization_id ?? null;
  }

  /** The teacher's SOLO organisation id, creating it (once, even under parallel requests) if missing. */
  async ensureForTeacher(user: { id: string; full_name?: string | null }): Promise<string> {
    const existing = await this.findIdForOwner(user.id);
    if (existing) return existing;

    return this.dataSource.transaction(async (manager) => {
      // Serialise per teacher so two first requests cannot both create one.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`solo-organization:${user.id}`]);
      const created = await this.findIdForOwner(user.id, manager);
      if (created) return created;

      const name = (user.full_name?.trim() || 'My Teaching').slice(0, 200);
      const organization = await manager.getRepository(OrganizationEntity).save(
        manager.getRepository(OrganizationEntity).create({
          name,
          kind: OrganizationKindEnum.SOLO,
          status: OrganizationStatusEnum.APPROVED,
          created_by: user.id,
          created_user_name: name.slice(0, 100),
          created_at: new Date(),
        }),
      );
      await manager.getRepository(OrganizationMemberEntity).save(
        manager.getRepository(OrganizationMemberEntity).create({
          organization_id: organization.id,
          user_id: user.id,
          role: OrganizationMemberRoleEnum.OWNER,
          is_active: ActiveStatusEnum.ACTIVE,
          created_by: user.id,
          created_user_name: name.slice(0, 100),
          created_at: new Date(),
        }),
      );
      return organization.id;
    });
  }
}
