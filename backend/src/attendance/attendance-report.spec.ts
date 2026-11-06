import { attendancePct, countMark, dayMark, emptyCounts } from './attendance-report';

describe('attendancePct (ATT-18, ATT-13)', () => {
  it('is (present + late) ÷ (present + late + absent), whole percent', () => {
    expect(attendancePct({ present: 3, late: 1, absent: 1 })).toBe(80);
    expect(attendancePct({ present: 1, late: 0, absent: 2 })).toBe(33);
    expect(attendancePct({ present: 2, late: 0, absent: 1 })).toBe(67);
  });

  it('does not hold leave against anyone and is null before any class counts', () => {
    const counts = emptyCounts();
    countMark(counts, 'LEAVE');
    countMark(counts, 'LEAVE');
    expect(attendancePct(counts)).toBeNull();
    countMark(counts, 'PRESENT');
    expect(attendancePct(counts)).toBe(100);
  });

  it('counts only marks, several at once when asked', () => {
    const counts = emptyCounts();
    for (const status of ['UPCOMING', 'OPEN', 'NOT_RECORDED', 'CANCELLED', 'CLOSED_DAY', null] as const) countMark(counts, status);
    expect(counts).toEqual(emptyCounts());
    countMark(counts, 'ABSENT', 4);
    expect(counts.absent).toBe(4);
  });
});

describe('dayMark (ATT-13 daily summary)', () => {
  it('is Absent only when every class held that day was missed (the absence SMS rule)', () => {
    expect(dayMark(['ABSENT', 'ABSENT', 'CANCELLED'])).toEqual({ status: 'ABSENT', missed: 0, waiting: 0 });
    expect(dayMark(['ABSENT', 'PRESENT'])).toEqual({ status: 'PRESENT', missed: 1, waiting: 0 });
  });

  it('is Late when any class was late, and counts the classes missed', () => {
    expect(dayMark(['PRESENT', 'LATE', 'ABSENT'])).toEqual({ status: 'LATE', missed: 1, waiting: 0 });
  });

  it('is Leave when on leave and at no class', () => {
    expect(dayMark(['LEAVE', 'LEAVE'])).toEqual({ status: 'LEAVE', missed: 0, waiting: 0 });
    expect(dayMark(['LEAVE', 'ABSENT'])).toEqual({ status: 'LEAVE', missed: 1, waiting: 0 });
  });

  it('waits for classes to come and paper registers not in yet; Absent so far stays Absent', () => {
    expect(dayMark(['UPCOMING', 'NOT_RECORDED'])).toEqual({ status: 'WAITING', missed: 0, waiting: 2 });
    expect(dayMark(['ABSENT', 'OPEN'])).toEqual({ status: 'ABSENT', missed: 0, waiting: 1 });
  });

  it('is null when no class counts (cancelled, closed day, not theirs)', () => {
    expect(dayMark(['CANCELLED', null, 'CLOSED_DAY'])).toBeNull();
    expect(dayMark([])).toBeNull();
  });
});
