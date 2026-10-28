import { FindManyOptions, FindOneOptions, FindOptionsWhere, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantContext } from './tenant-context';

type TenantEntity = ObjectLiteral & { organization_id: string | null };

/**
 * Repository access that always stays inside one organisation (design §8.1): every read adds
 * `organization_id = :orgId`. By default the organisation is the request's tenant; jobs and
 * scripts pass it explicitly with `forOrganization`.
 *
 *   const classes = tenantScoped(this.classRepo);
 *   await classes.find({ where: { teacher_id: userId } });
 */
export class TenantRepository<T extends TenantEntity> {
  constructor(
    private readonly repo: Repository<T>,
    private readonly organizationId: () => string = () => TenantContext.requireOrganizationId(),
  ) {}

  /** The same repository pinned to another organisation (background jobs, platform admin). */
  forOrganization(organizationId: string): TenantRepository<T> {
    return new TenantRepository(this.repo, () => organizationId);
  }

  find(options: FindManyOptions<T> = {}): Promise<T[]> {
    return this.repo.find({ ...options, where: this.scope(options.where) });
  }

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repo.findOne({ ...options, where: this.scope(options.where) });
  }

  count(options: FindManyOptions<T> = {}): Promise<number> {
    return this.repo.count({ ...options, where: this.scope(options.where) });
  }

  /** A query builder that already has `<alias>.organization_id = :tenantOrganizationId`; add conditions with `andWhere`. */
  createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    return this.repo
      .createQueryBuilder(alias)
      .where(`${alias}.organization_id = :tenantOrganizationId`, { tenantOrganizationId: this.organizationId() });
  }

  /** The organisation new rows must be saved with. */
  get currentOrganizationId(): string {
    return this.organizationId();
  }

  private scope(where: FindManyOptions<T>['where']): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const organization_id = this.organizationId();
    if (Array.isArray(where)) {
      return where.map((clause) => ({ ...clause, organization_id }) as FindOptionsWhere<T>);
    }
    return { ...(where ?? {}), organization_id } as FindOptionsWhere<T>;
  }
}

export const tenantScoped = <T extends TenantEntity>(repo: Repository<T>): TenantRepository<T> => new TenantRepository(repo);
