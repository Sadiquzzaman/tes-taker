export const isTeacherExamListItem = (test: TestListItem | TeacherShareableTest): test is TeacherExamListItem => {
  return "formState" in test && "publishState" in test;
};

export const getTestSubjectLabel = (test: TestListItem): string => {
  if (isTeacherExamListItem(test)) {
    if (test.exam_category === "ielts" || test.formState?.examCategory === "ielts") {
      const moduleNames = test.subjects.map((subject) => subject.name).filter(Boolean);
      return moduleNames.length ? moduleNames.join(", ") : "IELTS";
    }
    return test.subjects[0]?.name ?? "—";
  }

  if (test.exam_category === "ielts") {
    return test.subject ? `IELTS · ${test.subject}` : "IELTS";
  }

  return test.subject ?? "—";
};

/** The test's category ("academic" | "ielts"), shown with tests.category.* — or null when unknown. */
export const getTestCategory = (test: TestListItem): "academic" | "ielts" | null => {
  const category =
    ("exam_category" in test && test.exam_category) ||
    (isTeacherExamListItem(test) ? test.formState?.examCategory : undefined);
  return category === "ielts" || category === "academic" ? category : null;
};

export const getTestAudienceLabel = (test: TestListItem | TeacherShareableTest): string => {
  if (isTeacherExamListItem(test)) {
    return test.class_name ?? "—";
  }

  if ("class" in test) {
    return test.class_name ?? test.class?.class_name ?? "—";
  }

  return test.class_name ?? "—";
};

export const getTestCounts = (test: TestListItem | TeacherShareableTest) => {
  return {
    participantCount: test.participant_count ?? 0,
    submittedCount: test.submitted_count ?? 0,
  };
};

export const getTestScheduleRange = (test: TestListItem) => {
  if (isTeacherExamListItem(test)) {
    return {
      startAt: test.publishState.scheduleAt,
      endAt: test.publishState.endingAt,
    };
  }

  return {
    startAt: test.exam_start_time,
    endAt: test.exam_end_time,
  };
};

export const getTeacherShareMeta = (test: TeacherShareableTest) => {
  if (isTeacherExamListItem(test)) {
    return {
      publishTiming: test.publishState.publishTiming,
      scheduledAt: test.publishState.scheduleAt,
      testAudience: test.publishState.testAudience,
      className: test.class_name ?? "—",
      excludedStudentsCount: test.publishState.excluded_students.length,
    };
  }

  return {
    publishTiming: test.publish_timing,
    scheduledAt: test.exam_start_time,
    testAudience: test.test_audience,
    className: test.class?.class_name ?? test.class_name ?? "—",
    excludedStudentsCount: test.excluded_students.length,
  };
};
