import { IELTS_DEFAULT_BAND_TABLES } from './band-table-defaults';
import { bandFromRaw, scaledRaw, isValidBandTable, overallBand, roundBand, writingBand } from './bands';

describe('IELTS bands', () => {
  const table = [
    { min_raw: 39, band: 9 },
    { min_raw: 30, band: 7 },
    { min_raw: 16, band: 5 },
    { min_raw: 0, band: 0 },
  ];

  it('reads a raw score through the band table', () => {
    expect([40, 39, 38, 30, 29, 16, 15, 0].map((raw) => bandFromRaw(table, raw))).toEqual([9, 9, 7, 7, 5, 5, 0, 0]);
  });

  it('rounds to the nearest half band: .25 up to .5, .75 up to the next band', () => {
    expect([6, 6.125, 6.25, 6.5, 6.625, 6.75, 6.875].map(roundBand)).toEqual([6, 6, 6.5, 6.5, 6.5, 7, 7]);
    expect(overallBand([6.5, 6.5, 5, 7])).toBe(6.5); // 6.25
    expect(overallBand([6.5, 6.5, 6.5, 7.5])).toBe(7); // 6.75
    expect(overallBand([6, 6, 6, 6.5])).toBe(6); // 6.125
  });

  it('counts Writing Task 2 double', () => {
    expect(writingBand(6, 7)).toBe(6.5); // 20 / 3 = 6.67
    expect(writingBand(5, 7)).toBe(6.5); // 19 / 3 = 6.33
    expect(writingBand(7, 7)).toBe(7);
  });

  it('accepts only tables that go down from 40 to 0 in half bands', () => {
    expect(isValidBandTable(table)).toBe(true);
    expect(isValidBandTable([])).toBe(false);
    expect(isValidBandTable([{ min_raw: 39, band: 9 }])).toBe(false); // must end at 0
    expect(isValidBandTable([{ min_raw: 30, band: 7 }, { min_raw: 30, band: 6 }, { min_raw: 0, band: 0 }])).toBe(false);
    expect(isValidBandTable([{ min_raw: 30, band: 6 }, { min_raw: 20, band: 7 }, { min_raw: 0, band: 0 }])).toBe(false);
    expect(isValidBandTable([{ min_raw: 41, band: 9 }, { min_raw: 0, band: 0 }])).toBe(false);
    expect(isValidBandTable([{ min_raw: 30, band: 7.3 }, { min_raw: 0, band: 0 }])).toBe(false);
    expect(isValidBandTable([{ min_raw: 30.5, band: 7 }, { min_raw: 0, band: 0 }])).toBe(false);
  });

  it('ships default tables that are valid and give band 9 only for a top score', () => {
    for (const table of IELTS_DEFAULT_BAND_TABLES) {
      expect(isValidBandTable(table.rows)).toBe(true);
      expect(bandFromRaw(table.rows, 40)).toBe(9);
      expect(bandFromRaw(table.rows, 30)).toBeLessThan(9);
    }
  });

  it('scales a short practice set to 40 before banding', () => {
    expect(scaledRaw(12, 13)).toBe(37);
    expect(scaledRaw(3, 5)).toBe(24);
    expect(scaledRaw(30, 40)).toBe(30);
    expect(scaledRaw(0, 13)).toBe(0);
    expect(scaledRaw(5, 0)).toBe(5);
  });
});
