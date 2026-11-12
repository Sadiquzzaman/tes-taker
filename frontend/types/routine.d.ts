/** The weekly class routine (P5-04, CAL-01, CAL-02): as the API returns it (`GET /routine`). */
type RoutineClashKind = "TEACHER" | "ROOM";

interface RoutineSection {
  id: string;
  name: string;
  class_name: string | null;
}

/** Another slot with the same teacher or room at an overlapping time (CAL-02). */
interface RoutineClash {
  kind: RoutineClashKind;
  slot_id: string;
  section: RoutineSection;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface RoutineSlot {
  id: string;
  session_id: string;
  section: RoutineSection;
  subject: { offering_id: string; id: string; name: string } | null;
  teacher: { id: string; full_name: string } | null;
  room: string | null;
  /** ISO day: 1 Monday … 7 Sunday */
  day_of_week: number;
  /** "HH:MM" in the organisation's time zone */
  start_time: string;
  end_time: string;
  clashes: RoutineClash[];
}

interface RoutineView {
  session: { id: string; name: string; status: string };
  /** The caller may change at least one section. */
  can_manage: boolean;
  /** Sections the caller may change: all for owners, admins and staff; the ones a teacher teaches. */
  editable_section_ids: string[];
  sections: RoutineSection[];
  subject_classes: { offering_id: string; section_id: string; subject: { id: string; name: string }; teacher_ids: string[] }[];
  /** Everyone who teaches in these sections (a subject's teachers and teachers named on a period), by name. */
  teachers: { id: string; full_name: string }[];
  rooms: string[];
  slots: RoutineSlot[];
}

/** What the slot form sends (`POST /routine/slots`, `PATCH /routine/slots/:id`). */
interface RoutineSlotInput {
  section_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  offering_id: string | null;
  teacher_id: string | null;
  room: string | null;
  confirm_clashes?: boolean;
}
