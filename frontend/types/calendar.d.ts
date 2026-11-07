/** The person's calendar (P5-05, CAL-07): `GET /calendar/feed`. Times are ISO instants. */
type CalendarEventType = "EXAM" | "MEETING" | "PARENT_MEETING" | "ACTIVITY" | "OTHER";

type CalendarFeedItem =
  | {
      kind: "CLASS";
      id: string;
      date: string;
      starts_at: string;
      ends_at: string;
      title: string;
      section: { id: string; name: string; class_name: string };
      subject: string | null;
      teacher: string | null;
      room: string | null;
      role: "STUDENT" | "TEACHER";
      status: CalendarStatus;
    }
  | { kind: "EVENT"; id: string; starts_at: string; ends_at: string; title: string; event_type: CalendarEventType; place: string | null; cancelled: boolean }
  | { kind: "EXAM"; id: string; starts_at: string; ends_at: string; title: string; class_name: string | null }
  | { kind: "HOLIDAY"; id: string; date: string; title: string | null; reason: "WEEKLY_OFF" | "HOLIDAY" };

interface CalendarFeed {
  from: string;
  to: string;
  time_zone: string;
  items: CalendarFeedItem[];
}

/** An event (CAL-03): `GET /events/:id`. */
interface CalendarEventItem {
  id: string;
  type: CalendarEventType;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  place: string | null;
  whole_org: boolean;
  status: "SCHEDULED" | "CANCELLED";
  sections: { id: string; name: string; class_name: string | null }[];
  people: { id: string; full_name: string }[];
  created_by: { id: string; full_name: string } | null;
  cancelled_at: string | null;
  can_edit: boolean;
}

/** What the event form sends (`POST /events`, `PATCH /events/:id`). */
interface CalendarEventInput {
  type: CalendarEventType;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  place: string | null;
  whole_org: boolean;
  section_ids: string[];
  user_ids: string[];
}

/** Reminders (P5-05, CAL-05): `GET /reminders`. */
type ReminderTarget = "CLASS" | "EXAM" | "EVENT";

interface ReminderOffset {
  /** Minutes before the start, 5 to 1440. */
  minutes: number;
  channel: "IN_APP" | "SMS";
}

interface ReminderSettings {
  defaults: Record<ReminderTarget, ReminderOffset[]>;
  mine: Record<ReminderTarget, { offsets: ReminderOffset[]; own: boolean }>;
  can_manage: boolean;
}
