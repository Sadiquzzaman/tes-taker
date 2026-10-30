/** Where an outgoing message is (FND-14). */
type OutboxStatus = "PENDING" | "SENDING" | "SENT" | "DELIVERED" | "FAILED" | "NO_CREDIT";
type NotificationChannel = "SMS" | "EMAIL" | "IN_APP";

/** One SMS or email in the workspace's message log (GET /notifications/log). */
interface MessageLogItem {
  id: string;
  created_at: string;
  sent_at: string | null;
  event_type: string;
  channel: NotificationChannel;
  status: OutboxStatus;
  recipient: { id: string; full_name: string | null } | null;
  recipient_type: "USER" | "GUARDIAN" | "ADDRESS";
  to_address: string | null;
  subject: string | null;
  body: string | null;
  credits_used: number;
  attempts: number;
  error: string | null;
}

interface MessageLogResponse {
  message: string;
  payload: MessageLogItem[];
  meta: { page: number; limit: number; total: number; total_pages: number };
}

/** A self-serve SMS top-up; the price is the server's (BDT). */
interface SmsTopUpPack {
  id: string;
  credits: number;
  price: number;
}

/** A workspace's SMS credits this month (GET /sms-credits, FND-13). */
interface SmsCreditSummary {
  period: string;
  allowance: { granted: number; left: number };
  top_up: { left: number };
  total_left: number;
  low: boolean;
  packs: SmsTopUpPack[];
}

/** One message in the signed-in user's in-app inbox (the bell, FND-12). */
interface InboxItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  /** A path in the web app, e.g. /billing */
  link: string | null;
  read_at: string | null;
  created_at: string;
  organization_id: string | null;
}

interface InboxResponse {
  message: string;
  payload: InboxItem[];
  meta: { page: number; limit: number; total: number; total_pages: number; unread: number };
}

/** The channels the user gets one kind of message on; in-app is always on. */
interface NotificationPref {
  event_type: string;
  channels: NotificationChannel[];
  allowed: NotificationChannel[];
}
