import { compareVersions, updateNeeded } from './app-version';

describe('app versions (PM-03)', () => {
  it('compares dotted versions by number', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.1', '1.0.0')).toBe(-1);
    expect(compareVersions('2.0.0-beta.1', '2.0.0')).toBe(0);
  });

  it('says whether an update is needed', () => {
    expect(updateNeeded('1.0.0', '1.2.0', '1.5.0')).toBe('REQUIRED');
    expect(updateNeeded('1.3.0', '1.2.0', '1.5.0')).toBe('OPTIONAL');
    expect(updateNeeded('1.5.0', '1.2.0', '1.5.0')).toBe('NONE');
  });
});
