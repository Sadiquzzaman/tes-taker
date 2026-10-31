import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { EXAMS_QUEUE, FILES_QUEUE, NOTIFICATIONS_QUEUE } from './queue.constants';

export const BULL_BOARD_PATH = '/api/admin/queues';

/** Delay before answering a wrong login, to slow down password guessing. */
const FAILED_LOGIN_DELAY_MS = 1_000;

const sameSecret = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/** HTTP basic auth against one username/password, compared in constant time. */
export function basicAuth(user: string, password: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const givenUser = separator >= 0 ? decoded.slice(0, separator) : '';
      const givenPassword = separator >= 0 ? decoded.slice(separator + 1) : '';
      // Evaluate both, so the response time does not reveal which part was wrong.
      const userOk = sameSecret(givenUser, user);
      const passwordOk = sameSecret(givenPassword, password);
      if (userOk && passwordOk) {
        next();
        return;
      }
    }
    setTimeout(() => {
      res.setHeader('WWW-Authenticate', 'Basic realm="queues", charset="UTF-8"');
      res.status(401).send('Authentication required');
    }, header ? FAILED_LOGIN_DELAY_MS : 0);
  };
}

/**
 * bull-board (queue dashboard) at /api/admin/queues for admins, protected by basic auth from
 * BULL_BOARD_USER / BULL_BOARD_PASSWORD. Off when either is not set.
 */
export function mountBullBoard(app: INestApplication): boolean {
  const user = process.env.BULL_BOARD_USER?.trim();
  const password = process.env.BULL_BOARD_PASSWORD?.trim();
  if (!user || !password) {
    Logger.log('Queue dashboard off (BULL_BOARD_USER / BULL_BOARD_PASSWORD not set)', 'BullBoard');
    return false;
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);
  createBullBoard({
    queues: [EXAMS_QUEUE, NOTIFICATIONS_QUEUE, FILES_QUEUE].map((name) => new BullMQAdapter(app.get<Queue>(getQueueToken(name)))),
    serverAdapter,
  });
  app.use(BULL_BOARD_PATH, basicAuth(user, password), serverAdapter.getRouter());
  Logger.log(`Queue dashboard at ${BULL_BOARD_PATH}`, 'BullBoard');
  return true;
}
