import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from 'src/config/redis.service';
import { ExamEntity } from './entities/exam.entity';
import {
  EXAM_PAPER_CACHE_TTL_SECONDS,
  EXAM_PAPER_RELATIONS,
  examPaperCacheKey,
} from './exam-paper-cache.constants';

/**
 * Cache-aside loader for the heavy exam + questions graph.
 * Redis failures are swallowed so exam taking falls back to PostgreSQL.
 */
@Injectable()
export class ExamPaperCacheService {
  private readonly logger = new Logger(ExamPaperCacheService.name);

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,
  ) {}

  /**
   * Returns a hydrated exam graph from Redis or PostgreSQL.
   * Does not perform authorization — callers must still enforce access rules.
   */
  async getExamGraph(examId: string): Promise<ExamEntity | null> {
    const cached = await this.tryGet(examId);
    if (cached) {
      return cached;
    }

    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: [...EXAM_PAPER_RELATIONS],
    });

    if (exam) {
      await this.trySet(exam);
    }

    return exam ?? null;
  }

  /** Force-load from PostgreSQL and refresh the cache (used after mutations if needed). */
  async refreshExamGraph(examId: string): Promise<ExamEntity | null> {
    await this.invalidate(examId);
    return this.getExamGraph(examId);
  }

  async invalidate(examId: string): Promise<void> {
    const key = examPaperCacheKey(examId);
    try {
      await this.redisService.del(key);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate exam paper cache for ${examId}: ${(error as Error).message}`,
      );
    }
  }

  private async tryGet(examId: string): Promise<ExamEntity | null> {
    const key = examPaperCacheKey(examId);
    try {
      const raw = await this.redisService.get(key);
      if (!raw) {
        return null;
      }
      return this.deserialize(raw);
    } catch (error) {
      this.logger.warn(
        `Exam paper cache GET failed for ${examId}; falling back to PostgreSQL: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async trySet(exam: ExamEntity): Promise<void> {
    const key = examPaperCacheKey(exam.id);
    try {
      await this.redisService.set(key, this.serialize(exam), EXAM_PAPER_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `Exam paper cache SET failed for ${exam.id}; continuing without cache: ${(error as Error).message}`,
      );
    }
  }

  private serialize(exam: ExamEntity): string {
    return JSON.stringify(exam);
  }

  private deserialize(raw: string): ExamEntity {
    const plain = JSON.parse(raw) as ExamEntity;
    const reviveDates = (value: unknown): unknown => {
      if (value === null || value === undefined) {
        return value;
      }
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
          return d;
        }
      }
      if (Array.isArray(value)) {
        return value.map(reviveDates);
      }
      if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          out[k] = reviveDates(v);
        }
        return out;
      }
      return value;
    };

    return this.examRepo.create(reviveDates(plain) as ExamEntity);
  }
}
