import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { LeaveRequestEntity, LeaveStatusEnum } from './entities/leave-request.entity';

/** One person's approved leave: the request and its days. */
export interface ApprovedLeave {
  id: string;
  person_id: string;
  from_date: string;
  to_date: string;
}

/** Approved leave by person, with a lookup for one date. */
export class LeaveCalendar {
  private readonly byPerson = new Map<string, ApprovedLeave[]>();

  constructor(leaves: ApprovedLeave[]) {
    for (const leave of leaves) this.byPerson.set(leave.person_id, [...(this.byPerson.get(leave.person_id) ?? []), leave]);
  }

  /** The approved request covering the person's date, if any. */
  on(personId: string, date: string): ApprovedLeave | null {
    return this.byPerson.get(personId)?.find((leave) => leave.from_date <= date && date <= leave.to_date) ?? null;
  }
}

/**
 * Approved leave (ATT-09, ATT-11) for the attendance jobs and views: the closing job saves LEAVE
 * instead of Absent for someone on approved leave, and "My attendance" and the class view show a
 * class without a record on those days as Leave. No access checks; the callers check.
 */
@Injectable()
export class ApprovedLeaveService {
  constructor(
    @InjectRepository(LeaveRequestEntity)
    private readonly leaveRepo: Repository<LeaveRequestEntity>,
  ) {}

  /** Approved leave overlapping `from`–`to`, for these people (or everyone in the organisation). */
  async between(organizationId: string, from: string, to: string, personIds?: string[], manager?: EntityManager): Promise<LeaveCalendar> {
    if (personIds && personIds.length === 0) return new LeaveCalendar([]);
    const repo = manager ? manager.getRepository(LeaveRequestEntity) : this.leaveRepo;
    const rows = await repo.find({
      where: {
        organization_id: organizationId,
        status: LeaveStatusEnum.APPROVED,
        from_date: LessThanOrEqual(to),
        to_date: MoreThanOrEqual(from),
        ...(personIds ? { person_id: In([...new Set(personIds)]) } : {}),
      },
      select: ['id', 'person_id', 'from_date', 'to_date'],
    });
    return new LeaveCalendar(rows);
  }
}
