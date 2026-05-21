interface CalendarCell {
  day: number;
  currentMonth: boolean;
}

interface SampleTestDate {
  year: number;
  month: number;
  day: number;
  tests: number;
}

interface ActivityData {
  name: string;
  exam: number;
  participate: number;
}

interface ActivityDuration {
  name: string;
  value: string;
}

interface ClassStudentData {
  name: string;
  student: number;
}

interface ClassListItem {
  name: string;
  value: string;
}

interface StudentListItem {
  name: string;
  tests: number;
  avgScore: string;
}

interface UpcomingTestData {
  test: string;
  className: string;
  starts: string;
  duration: string;
  students: number;
}

interface ActivityTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload: ActivityData;
  }>;
}

interface ClassesTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{
    value?: number;
  }>;
}
