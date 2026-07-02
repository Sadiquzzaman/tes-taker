type DashboardActivityPeriod = "monthly" | "weekly" | "daily";

interface DashboardLiveTest {
  id: string;
  test_name: string | null;
  class_name: string | null;
  participant_count: number;
  submitted_count: number;
  remaining_seconds: number;
  exam_end_time: string;
}

interface DashboardStudentsSummary {
  total: number;
  joined: number;
  pending: number;
  active: number;
}

interface DashboardUpcomingTest {
  id: string;
  test_name: string | null;
  class_name: string | null;
  exam_start_time: string;
  duration_minutes: number | null;
  student_count: number;
}

interface DashboardClassSummary {
  id: string;
  name: string;
  student_count: number;
}

interface DashboardTopStudent {
  student_id: string;
  name: string;
  tests_taken: number;
  avg_score_percent: number | null;
}

interface DashboardTopStudentsByClass {
  class_id: string;
  class_name: string;
  students: DashboardTopStudent[];
}

interface DashboardCalendarEvent {
  year: number;
  month: number;
  day: number;
  test_count: number;
}

interface DashboardActivityPoint {
  label: string;
  exam_count: number;
  participant_count: number;
}

interface DashboardActivity {
  period: DashboardActivityPeriod;
  data: DashboardActivityPoint[];
}

interface TeacherDashboardPayload {
  pending_grading_count: number;
  live_tests: DashboardLiveTest[];
  students_summary: DashboardStudentsSummary;
  upcoming_tests: DashboardUpcomingTest[];
  classes_summary: DashboardClassSummary[];
  top_students_by_class: DashboardTopStudentsByClass[];
  calendar_events: DashboardCalendarEvent[];
  activity: DashboardActivity;
}

interface TeacherDashboardQuery {
  activity_period?: DashboardActivityPeriod;
  calendar_year?: number;
  calendar_month?: number;
}
