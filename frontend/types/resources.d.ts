/** The resource library (P9-03, Epic 8): `GET /resources`, `GET /resources/mine`. */
type ResourceType = "FILE" | "VIDEO" | "LINK";

interface LibraryResource {
  id: string;
  type: ResourceType;
  title: string;
  description: string | null;
  subject: { id: string; name: string } | null;
  folder_id: string | null;
  tags: string[];
  download_allowed: boolean;
  archived: boolean;
  /** FILE: `/files/:id/content`; LINK: the address. */
  url: string;
  file: { name: string; mime: string; size: number } | null;
  shares: { offering_id: string; label: string }[];
  created_by: { id: string; name: string };
  created_at: string;
  can_edit?: boolean;
  is_new?: boolean;
}

interface ResourceShareOption {
  offering_id: string;
  label: string;
  subject: { id: string; name: string };
}

interface ResourceFolder {
  id: string;
  name: string;
}

interface ResourceInsights {
  students: number;
  opened: { student_id: string; full_name: string; via: string; first_opened_at: string; last_opened_at: string; opens: number }[];
  not_opened: { student_id: string; full_name: string; via: string }[];
}
