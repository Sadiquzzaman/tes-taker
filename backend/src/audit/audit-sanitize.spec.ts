import { auditChanges, sanitizeAuditState } from './audit-sanitize';

describe('sanitizeAuditState', () => {
  it('drops secrets, hashes and sign-in ids at any depth', () => {
    const clean = sanitizeAuditState({
      role: 'TEACHER',
      password: 'x',
      refresh_token: 'x',
      otp: '123456',
      otp_code: '123456',
      password_hash: 'x',
      google_id: 'g-1',
      api_key: 'k',
      user: { full_name: 'Rahim', password: 'x', nested: { secret: 'x', token_hash: 'x', ok: 1 } },
      list: [{ access_token: 'x', name: 'a' }],
    });
    expect(clean).toEqual({
      role: 'TEACHER',
      user: { full_name: 'Rahim', nested: { ok: 1 } },
      list: [{ name: 'a' }],
    });
    expect(JSON.stringify(clean)).not.toMatch(/password|token|secret|otp|hash|google|api_key/i);
  });

  it('keeps ordinary keys that only look similar (plan features, scores)', () => {
    expect(sanitizeAuditState({ allow_passage_questions: true, passing_score: 40, hashtag: 'a', topic: 'b' })).toEqual({
      allow_passage_questions: true,
      passing_score: 40,
      hashtag: 'a',
      topic: 'b',
    });
  });

  it('turns dates into ISO strings and wraps non-objects', () => {
    expect(sanitizeAuditState({ at: new Date('2026-10-30T00:00:00Z') })).toEqual({ at: '2026-10-30T00:00:00.000Z' });
    expect(sanitizeAuditState(5)).toEqual({ value: 5 });
    expect(sanitizeAuditState(null)).toBeNull();
    expect(sanitizeAuditState(undefined)).toBeNull();
  });
});

describe('auditChanges', () => {
  it('keeps only the fields that changed', () => {
    expect(
      auditChanges(
        { name: 'Pro', price_monthly: 499, features: { a: true }, password: 'x' },
        { name: 'Pro', price_monthly: 599, features: { a: false }, password: 'y' },
      ),
    ).toEqual({
      before: { price_monthly: 499, features: { a: true } },
      after: { price_monthly: 599, features: { a: false } },
    });
  });

  it('returns nulls when nothing changed', () => {
    expect(auditChanges({ a: 1 }, { a: 1 })).toEqual({ before: null, after: null });
  });
});
