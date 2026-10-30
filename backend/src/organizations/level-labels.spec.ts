import {
  buildLevelLabels,
  DEFAULT_LEVEL_LABELS,
  LEVEL_LABEL_PRESETS,
  levelLabel,
  LevelLabelPresetEnum,
  resolveLevelLabels,
} from './level-labels';

const custom = {
  class: { en: { one: ' Programme ', other: 'Programmes' }, bn: 'প্রোগ্রাম' },
  section: { en: { one: 'Group', other: 'Groups' }, bn: 'গ্রুপ' },
};

/** FND-03: an organisation's names for its two academic levels. */
describe('level labels', () => {
  it('uses Class / Section when the organisation has none', () => {
    expect(resolveLevelLabels(null)).toEqual(DEFAULT_LEVEL_LABELS);
    expect(DEFAULT_LEVEL_LABELS.class).toEqual({ en: { one: 'Class', other: 'Classes' }, bn: 'ক্লাস' });
  });

  it('builds the Course / Batch preset and ignores names sent with it', () => {
    expect(buildLevelLabels(LevelLabelPresetEnum.COURSE_BATCH, custom)).toEqual(
      LEVEL_LABEL_PRESETS[LevelLabelPresetEnum.COURSE_BATCH],
    );
  });

  it('keeps custom names, trimmed', () => {
    expect(buildLevelLabels(LevelLabelPresetEnum.CUSTOM, custom)).toEqual({
      preset: LevelLabelPresetEnum.CUSTOM,
      class: { en: { one: 'Programme', other: 'Programmes' }, bn: 'প্রোগ্রাম' },
      section: custom.section,
    });
  });

  it('refuses custom names that are missing, blank or too long', () => {
    expect(buildLevelLabels(LevelLabelPresetEnum.CUSTOM)).toBeNull();
    expect(buildLevelLabels(LevelLabelPresetEnum.CUSTOM, { ...custom, section: { en: { one: 'Group', other: '  ' }, bn: 'গ্রুপ' } })).toBeNull();
    expect(buildLevelLabels(LevelLabelPresetEnum.CUSTOM, { ...custom, class: { ...custom.class, bn: 'ক'.repeat(31) } })).toBeNull();
  });

  it('falls back to Class / Section for a stored value it cannot read', () => {
    expect(resolveLevelLabels({ preset: 'OTHER' })).toEqual(DEFAULT_LEVEL_LABELS);
    expect(resolveLevelLabels({ preset: LevelLabelPresetEnum.CUSTOM, class: custom.class })).toEqual(DEFAULT_LEVEL_LABELS);
  });

  it('gives one name per language for server-written text (SMS, PDFs)', () => {
    const stored = LEVEL_LABEL_PRESETS[LevelLabelPresetEnum.COURSE_BATCH];
    expect(levelLabel(stored, 'class', 'en')).toBe('Course');
    expect(levelLabel(stored, 'section', 'en', { plural: true })).toBe('Batches');
    expect(levelLabel(stored, 'section', 'bn')).toBe('ব্যাচ');
    expect(levelLabel(null, 'class', 'en', { plural: true })).toBe('Classes');
  });
});
