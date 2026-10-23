import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { StudentExamController } from './student-exam.controller';

/** Lists the routes declared on the controller as "METHOD path". */
const declaredRoutes = (): string[] => {
  const prototype = StudentExamController.prototype as unknown as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor' && typeof prototype[name] === 'function')
    .map((name) => {
      const handler = prototype[name] as object;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      return path === undefined || method === undefined ? null : `${RequestMethod[method]} ${path}`;
    })
    .filter((route): route is string => route !== null);
};

describe('StudentExamController routes', () => {
  it('no longer exposes the legacy exam endpoints', () => {
    const routes = declaredRoutes();

    // Served options in stored order (leaked matching answers) and paired with the old submit flow.
    expect(routes).not.toContain('GET :examId');
    // Saved a stale submission and had no guard against double submit; /answersheet replaces them.
    expect(routes).not.toContain('POST :examId/submit');
    expect(routes).not.toContain('POST :examId/auto-submit');
  });

  it('keeps the routes the exam page uses', () => {
    const routes = declaredRoutes();

    expect(routes).toEqual(
      expect.arrayContaining(['POST :examId/start', 'POST :examId/answersheet', 'POST :examId/report-violation']),
    );
  });
});
