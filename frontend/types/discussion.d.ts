type DiscussionPostCategory = "general" | "question" | "idea" | "resource";

interface DiscussionAuthor {
  id: string;
  name: string;
}

interface DiscussionAttachment {
  id: string;
  key: string;
  url: string;
  file_name: string;
  mime_type: string;
  size: number;
  kind: "image" | "file";
}

interface DiscussionSubjectOption {
  id: string;
  class_subject: {
    id: string;
    subject: {
      id: string;
      name: string;
      code: string | null;
    };
  };
  teachers: DiscussionAuthor[];
}

interface DiscussionPost {
  id: string;
  content: string;
  category: DiscussionPostCategory;
  attachments: DiscussionAttachment[];
  created_at: string;
  updated_at: string | null;
  comments_count: number;
  author: DiscussionAuthor;
  class_subject: {
    id: string;
    subject: {
      id: string;
      name: string;
      code: string | null;
    };
  };
}

interface DiscussionComment {
  id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  author: DiscussionAuthor;
}

interface DiscussionConversation {
  id: string;
  class_subject_id: string;
  created_at: string;
  student: DiscussionAuthor;
  teacher: DiscussionAuthor;
}

interface DiscussionMessage {
  id: string;
  content: string;
  attachments: DiscussionAttachment[];
  created_at: string;
  sender: DiscussionAuthor;
}

interface DiscussionPageMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface DiscussionListPayload<T> {
  items: T[];
  meta: DiscussionPageMeta;
}
