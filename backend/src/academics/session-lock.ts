import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AcademicSessionEntity, AcademicSessionStatusEnum } from './entities/academic-session.entity';

/**
 * A closed session's records are read-only (FND-01): its tests cannot be edited, switched on or
 * off, deleted, graded or published until the owner reopens the session. Viewing stays allowed.
 */
export async function assertExamSessionOpen(repo: Repository<AcademicSessionEntity>, sessionId: string | null | undefined): Promise<void> {
  if (!sessionId) return;
  const session = await repo.findOne({ where: { id: sessionId }, select: ['id', 'status'] });
  if (session?.status === AcademicSessionStatusEnum.CLOSED) {
    throw new BadRequestException('This test belongs to a closed session; the owner can reopen it');
  }
}
