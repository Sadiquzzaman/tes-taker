import {
  checkInState,
  distanceMetres,
  isEdgeAccuracy,
  isImpossibleJump,
  lateness,
  sessionWindow,
  zonedInstant,
} from './class-session-time';

describe('class session time', () => {
  it('turns a Dhaka wall-clock time into the right instant, also just after midnight', () => {
    expect(zonedInstant('2026-11-07', '16:00', 'Asia/Dhaka').toISOString()).toBe('2026-11-07T10:00:00.000Z');
    expect(zonedInstant('2026-11-07', '00:30', 'Asia/Dhaka').toISOString()).toBe('2026-11-06T18:30:00.000Z');
  });

  it('follows daylight saving in zones that have it', () => {
    expect(zonedInstant('2026-07-01', '09:00', 'Europe/London').toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(zonedInstant('2026-12-01', '09:00', 'Europe/London').toISOString()).toBe('2026-12-01T09:00:00.000Z');
  });

  it('opens check-in 15 minutes early, Late after the grace period, closes at the end', () => {
    const window = sessionWindow('2026-11-07', '16:00', '17:30', 'Asia/Dhaka', 10);
    expect(window.opens_at.toISOString()).toBe('2026-11-07T09:45:00.000Z');
    expect(window.late_after.toISOString()).toBe('2026-11-07T10:10:00.000Z');
    expect(window.ends_at.toISOString()).toBe('2026-11-07T11:30:00.000Z');

    expect(checkInState(new Date('2026-11-07T09:44:59Z'), window)).toBe('UPCOMING');
    expect(checkInState(new Date('2026-11-07T09:45:00Z'), window)).toBe('OPEN');
    expect(checkInState(new Date('2026-11-07T11:29:59Z'), window)).toBe('OPEN');
    expect(checkInState(new Date('2026-11-07T11:30:00Z'), window)).toBe('CLOSED');
  });

  it('is on time up to start + grace and Late after it, counting minutes from the start', () => {
    const window = sessionWindow('2026-11-07', '09:00', '10:00', 'Asia/Dhaka', 10);
    expect(lateness(new Date('2026-11-07T02:55:00Z'), window)).toEqual({ late: false, minutes: null });
    expect(lateness(new Date('2026-11-07T03:10:00Z'), window)).toEqual({ late: false, minutes: null });
    expect(lateness(new Date('2026-11-07T03:10:01Z'), window)).toEqual({ late: true, minutes: 10 });
    expect(lateness(new Date('2026-11-07T03:24:30Z'), window)).toEqual({ late: true, minutes: 24 });
  });

  it('measures distances and flags poor accuracy at the edge and impossible jumps', () => {
    // About 111 m per 0.001° of latitude.
    expect(Math.round(distanceMetres(23.758, 90.389, 23.759, 90.389))).toBe(111);
    expect(isEdgeAccuracy(60, 60, 100)).toBe(true);
    expect(isEdgeAccuracy(20, 60, 100)).toBe(false);
    expect(isEdgeAccuracy(90, 30, 100)).toBe(false);
    expect(isImpossibleJump(20_000, 5 * 60_000)).toBe(true);
    expect(isImpossibleJump(20_000, 60 * 60_000)).toBe(false);
    expect(isImpossibleJump(1_500, 1_000)).toBe(false);
  });
});
