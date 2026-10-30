import { afterEach, describe, expect, it } from "vitest";
import {
  applyLevelLabels,
  DEFAULT_LEVEL_LABELS,
  LEVEL_LABEL_PRESETS,
  LEVEL_LABELS_COOKIE,
  levelWord,
  parseLevelLabelsCookie,
  readLevelLabelsCookie,
  toLevelLabels,
  writeLevelLabelsCookie,
  type LevelLabels,
} from "./levelLabels";

const custom: LevelLabels = {
  preset: "CUSTOM",
  class: { en: { one: "HSC Programme", other: "HSC Programmes" }, bn: "প্রোগ্রাম" },
  section: { en: { one: "group", other: "groups" }, bn: "গ্রুপ" },
};

const clearCookie = () => {
  document.cookie = `${LEVEL_LABELS_COOKIE}=; path=/; max-age=0`;
};

describe("level labels (FND-03)", () => {
  afterEach(clearCookie);

  it("fills each token with the right form and case", () => {
    const labels = LEVEL_LABEL_PRESETS.COURSE_BATCH;
    expect(levelWord(labels, "class", "en")).toBe("course");
    expect(levelWord(labels, "Classes", "en")).toBe("Courses");
    expect(levelWord(labels, "sections", "en")).toBe("batches");
    expect(levelWord(labels, "Section", "bn")).toBe("ব্যাচ");
  });

  it("keeps acronyms and capitalises custom words as needed", () => {
    expect(levelWord(custom, "class", "en")).toBe("HSC Programme");
    expect(levelWord(custom, "Section", "en")).toBe("Group");
    expect(levelWord(custom, "sections", "en")).toBe("groups");
  });

  it("replaces tokens throughout a message tree", () => {
    const messages = { a: "Create [[class]]", b: { c: "[[Sections]] of the [[class]]", d: "No tokens {count, number}" } };
    expect(applyLevelLabels(messages, custom, "en")).toEqual({
      a: "Create HSC Programme",
      b: { c: "Groups of the HSC Programme", d: "No tokens {count, number}" },
    });
    expect(applyLevelLabels(messages, DEFAULT_LEVEL_LABELS, "bn").b).toEqual({ c: "সেকশন of the ক্লাস", d: "No tokens {count, number}" });
  });

  it("falls back to Class / Section for missing or malformed labels", () => {
    expect(toLevelLabels(null)).toBe(DEFAULT_LEVEL_LABELS);
    expect(toLevelLabels({ preset: "CUSTOM", class: custom.class })).toBe(DEFAULT_LEVEL_LABELS);
    expect(toLevelLabels({ preset: "COURSE_BATCH", class: custom.class })).toEqual(LEVEL_LABEL_PRESETS.COURSE_BATCH);
    expect(parseLevelLabelsCookie("not json")).toBe(DEFAULT_LEVEL_LABELS);
    expect(parseLevelLabelsCookie(undefined)).toBe(DEFAULT_LEVEL_LABELS);
  });

  it("saves labels in a cookie and says when they changed", () => {
    expect(readLevelLabelsCookie()).toEqual(DEFAULT_LEVEL_LABELS);
    expect(writeLevelLabelsCookie(DEFAULT_LEVEL_LABELS)).toBe(false);

    expect(writeLevelLabelsCookie(custom)).toBe(true);
    expect(readLevelLabelsCookie()).toEqual(custom);
    expect(writeLevelLabelsCookie(custom)).toBe(false);

    // Back to Class / Section clears the cookie.
    expect(writeLevelLabelsCookie(DEFAULT_LEVEL_LABELS)).toBe(true);
    expect(document.cookie).not.toContain(LEVEL_LABELS_COOKIE);
  });
});
