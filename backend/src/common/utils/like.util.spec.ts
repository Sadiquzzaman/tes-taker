import { escapeLikePattern } from './like.util';

describe('escapeLikePattern', () => {
  it('escapes the LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('PHY_1')).toBe('PHY\\_1');
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  it('leaves ordinary text unchanged', () => {
    expect(escapeLikePattern('Physics (Higher)')).toBe('Physics (Higher)');
  });
});
