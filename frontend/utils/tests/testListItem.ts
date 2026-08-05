export const isTeacherExamListItem = (test: TestListItem | TeacherShareableTest): test is TeacherExamListItem => {
  return "formState" in test && "publishState" in test;
};

export const getTestSubjectLabel = (test: TestListItem): string => {
  if (isTeacherExamListItem(test)) {
    if (test.exam_category === "ielts" || test.formState?.examCategory === "ielts") {
      const moduleNames = test.subjects.map((subject) => subject.name).filter(Boolean);
      return moduleNames.length ? moduleNames.join(", ") : "IELTS";
    }
    return test.subjects[0]?.name ?? "N/A";
  }

  if (test.exam_category === "ielts") {
    return test.subject ? `IELTS · ${test.subject}` : "IELTS";
  }

  return test.subject ?? "N/A";
};

export const getTestCategoryLabel = (test: TestListItem): "Academic" | "IELTS" | null => {
  const category =
    ("exam_category" in test && test.exam_category) ||
    (isTeacherExamListItem(test) ? test.formState?.examCategory : undefined);
  if (category === "ielts") {
    return "IELTS";
  }
  if (category === "academic") {
    return "Academic";
  }
  return null;
};

export const getTestAudienceLabel = (test: TestListItem | TeacherShareableTest): string => {
  if (isTeacherExamListItem(test)) {
    return test.class_name ?? "N/A";
  }

  if ("class" in test) {
    return test.class_name ?? test.class?.class_name ?? "N/A";
  }

  return test.class_name ?? "N/A";
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
      className: test.class_name ?? "N/A",
      excludedStudentsCount: test.publishState.excluded_students.length,
    };
  }

  return {
    publishTiming: test.publish_timing,
    scheduledAt: test.exam_start_time,
    testAudience: test.test_audience,
    className: test.class?.class_name ?? test.class_name ?? "N/A",
    excludedStudentsCount: test.excluded_students.length,
  };
};
