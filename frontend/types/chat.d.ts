/** Group chats (P9-01, COM-01): `GET /chat/groups`. */
type ChatRole = "TEACHER" | "STUDENT";

interface ChatGroupSummary {
  id: string;
  offering_id: string;
  class_id: string;
  section_label: string;
  subject: { id: string; name: string };
  role: ChatRole;
  announcement_only: boolean;
  read_only: boolean;
  muted: boolean;
  unread: number;
  teachers: { id: string; name: string }[];
  last_message: { author_name: string; preview: string; created_at: string } | null;
}

interface ChatMessage {
  id: string;
  group_id: string;
  parent_id: string | null;
  author: { id: string; name: string; is_teacher: boolean };
  content: string;
  attachments: { file_id: string; name: string; mime: string; size: number; url: string }[];
  reply_to: { id: string; author_name: string; content: string; deleted: boolean } | null;
  comment_count: number;
  last_comment_at: string | null;
  pinned: boolean;
  deleted: boolean;
  created_at: string;
}

/** `GET /chat/groups/:id`. */
interface ChatGroupDetail {
  id: string;
  label: string;
  class_id: string;
  role: ChatRole;
  announcement_only: boolean;
  read_only: boolean;
  closed?: boolean;
  muted: boolean;
  teachers: { id: string; name: string }[];
  pinned: ChatMessage[];
}

/** Private chats (P9-02, COM-02): `GET /chat/direct`. */
interface DirectChatSummary {
  id: string;
  other: { id: string; name: string; is_teacher: boolean };
  unread: number;
  /** When the other person last read the chat (read receipts). */
  other_read_at: string | null;
  closed: boolean;
  muted: boolean;
  last_message: { author_name: string; preview: string; created_at: string } | null;
}

/** `GET /chat/direct/contacts`: who the person may message. */
interface DirectContact {
  id: string;
  name: string;
  via: string[];
}

/** Socket events on `/chat`. */
type ChatSocketEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "deleted"; group_id: string; id: string; parent_id: string | null }
  | { type: "group"; group_id: string; pinned_ids: string[]; announcement_only: boolean }
  | { type: "read"; chat_id: string; user_id: string; at: string };

/** Supervising chats (P9-02, COM-04, COM-05): owners and admins. */
type ChatType = "GROUP" | "DIRECT";

interface AdminChat {
  type: ChatType;
  id: string;
  label: string;
  closed: boolean;
  last_activity: string | null;
}

interface ChatReport {
  id: string;
  chat_type: ChatType;
  chat_id: string;
  chat_label: string;
  message_id: string;
  reporter: { id: string; name: string };
  reason: string;
  context: { id: string; author_id: string; author_name: string; content: string; files: string[]; created_at: string; reported: boolean }[];
  status: "OPEN" | "RESOLVED";
  resolution: "KEPT" | "DELETED" | null;
  resolved_by: { id: string; name: string } | null;
  resolved_at: string | null;
  created_at: string;
}

interface ChatAccessLogRow {
  id: string;
  actor: { id: string; name: string };
  chat_type: ChatType;
  chat_id: string;
  chat_label: string;
  reason: string;
  opened_at: string;
}
