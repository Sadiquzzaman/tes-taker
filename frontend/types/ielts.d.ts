/** The IELTS workspace (P10, Epic 11). */
type IeltsModule = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
type IeltsTestType = "ACADEMIC" | "GENERAL";

/** `GET /ielts/profiles`, `/ielts/profiles/me`. */
interface IeltsProfile {
  student: { id: string; full_name: string; batch: string | null };
  test_type: IeltsTestType | null;
  target_overall: number | null;
  target_bands: Partial<Record<IeltsModule, number>>;
  test_date: string | null;
  /** Days until the booked test (negative once it has passed). */
  days_to_test: number | null;
  updated_at: string | null;
}
