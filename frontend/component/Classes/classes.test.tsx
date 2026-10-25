import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TagInput from "@/design/ui/TagInput";
import { renderApp, renderWithIntl } from "@/i18n/test-utils";
import { setOpenShareClassModal } from "@/lib/features/classSlice";
import { getValidationError } from "@/utils/classes/addStudentModal";
import { getClassStudentDisplayName } from "@/utils/classes/classStudentDisplay";
import ClassCard from "./ClassCard";
import ClassStudent from "./ClassStudent";
import CreateClassForm from "./CreateClassForm";
import ShareClassModal from "./ShareClassModal";
import DiscussionPostCard from "./discussions/DiscussionPostCard";

const approveStudent = vi.fn(async () => ({ statusCode: 201 }));
const removeStudent = vi.fn(async () => ({ statusCode: 200 }));
const createClass = vi.fn();
const createForm = {
  createClassPayload: { class_name: "", description: "", student_ids: [] as string[] },
  setCreateClassPayload: vi.fn(),
  value: "",
  setValue: vi.fn(),
  loading: false,
  fileInputRef: { current: null },
  tagInputRef: { current: null },
  invalidStudentIndices: [] as number[],
  addTag: vi.fn(),
  removeTag: vi.fn(),
  handleTagClick: vi.fn(),
  handleCsvUpload: vi.fn(),
  handleDownloadTemplate: vi.fn(),
  handleCreateClass: createClass,
  isIndividual: true,
};

vi.mock("@/hooks/api/class/useApproveStudent", () => ({ default: () => [approveStudent] }));
vi.mock("@/hooks/api/class/useRemoveStudentFromClass", () => ({ default: () => [removeStudent] }));
vi.mock("@/hooks/api/class/useAddStudentInClass", () => ({ default: () => [vi.fn(), { loading: false }] }));
vi.mock("@/hooks/classes/useCreateClassForm", () => ({ default: () => createForm }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/classes" }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const student = (overrides: Partial<ClassStudent>): ClassStudent =>
  ({ id: "cs1", student_id: "u1", status: "JOINED", joined_at: "2026-10-01T04:00:00Z", student: { full_name: "Nadia Rahman", phone: "01700000001" }, ...overrides }) as ClassStudent;

describe("TagInput", () => {
  const Example = () => {
    const [value, setValue] = useState("");
    const [tags, setTags] = useState<string[]>(["01711111111"]);
    return (
      <TagInput
        label="Students"
        value={value}
        onChange={setValue}
        tags={tags}
        invalidIndices={[]}
        onAdd={() => {
          setTags((current) => [...current, value.trim()]);
          setValue("");
        }}
        onRemove={(index) => setTags((current) => current.filter((_, i) => i !== index))}
      />
    );
  };

  it("adds a tag on Enter and removes one by its button or Backspace", () => {
    renderWithIntl(<Example />);
    const input = screen.getByLabelText("Students");
    fireEvent.change(input, { target: { value: "nadia@example.test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("nadia@example.test")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove 01711111111" }));
    expect(screen.queryByText("01711111111")).toBeNull();
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.queryByText("nadia@example.test")).toBeNull();
  });
});

describe("class card", () => {
  it("shows students and tests taken, and opens the share dialog", () => {
    const classItem = { id: "c1", class_name: "Physics 9A", classStudents: [{}, {}, {}], total_test_taken: 4, last_test_taken_date: null } as unknown as Class;
    const { store } = renderApp(<ClassCard classItem={classItem} index={0} />, { locale: "bn" });

    expect(screen.getByText("৩")).toBeTruthy();
    expect(screen.getByText("৪")).toBeTruthy();
    expect(screen.getByText("এখনো কোনো পরীক্ষা হয়নি")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ক্লাস শেয়ার করুন" }));
    expect(store.getState().class.openShareClassModal).toEqual(classItem);
    expect(screen.getByRole("link", { name: "ক্লাস দেখুন" }).getAttribute("href")).toBe("/classes/details/c1");
  });
});

describe("create class", () => {
  it("submits the form (Enter in a field, or its submit button)", () => {
    renderApp(<CreateClassForm />);
    const submit = screen.getByRole("button", { name: "Create class" });
    expect(submit.getAttribute("type")).toBe("submit");
    // jsdom does not submit forms on button clicks, so submit the form itself.
    fireEvent.submit(submit.closest("form")!);
    expect(createClass).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/classes");
  });
});

describe("class roster", () => {
  const roster = [
    student({}),
    student({ id: "cs2", student_id: "u2", status: "PENDING", student: { full_name: "Arif Hossain" } as ClassStudent["student"] }),
  ];

  it("approves a waiting student", async () => {
    renderApp(<ClassStudent student={roster} classId="c1" fetch={vi.fn()} role="TEACHER" />);
    const pending = screen.getByRole("table", { name: "Waiting for approval (1)" });
    fireEvent.click(within(pending).getByRole("button", { name: "Approve Arif Hossain" }));
    await waitFor(() => expect(approveStudent).toHaveBeenCalledWith("u2"));
  });

  it("asks before removing a student", async () => {
    renderApp(<ClassStudent student={roster} classId="c1" fetch={vi.fn()} role="TEACHER" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove Nadia Rahman from class" })[0]);
    expect(removeStudent).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeStudent).toHaveBeenCalledWith({ student_ids: ["u1"] }));
  });
});

describe("share class", () => {
  it("shows the join link with the class name", async () => {
    const { store } = renderApp(<ShareClassModal />);
    store.dispatch(setOpenShareClassModal({ id: "c1", class_name: "Physics 9A", classStudents: [], type: "new" }));
    expect(await screen.findByRole("dialog", { name: "Class created" })).toBeTruthy();
    expect(screen.getByText("“Physics 9A” is ready, with 0 invitations sent.")).toBeTruthy();
    expect(screen.getByText(/\/join\/class\/c1/)).toBeTruthy();
  });
});

describe("discussions", () => {
  const post = {
    id: "p1",
    content: "When is the test?",
    category: "question",
    author: { id: "me", name: "Nadia" },
    created_at: "2026-10-24T04:00:00Z",
    comments_count: 2,
    attachments: [],
  } as unknown as DiscussionPost;

  it("lets the author delete a post only after confirming", async () => {
    const onDelete = vi.fn();
    renderWithIntl(
      <DiscussionPostCard
        post={post}
        currentUserId="me"
        commentDraft=""
        onCommentDraftChange={vi.fn()}
        onToggleComments={vi.fn()}
        onSubmitComment={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onDeleteComment={vi.fn()}
      />,
    );
    expect(screen.getByText("Question")).toBeTruthy();
    expect(screen.getByRole("button", { name: "2 comments" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("class helpers", () => {
  it("names students without a name by their ID, in the page language", () => {
    const unnamed = student({ student: { student_public_id: "100234" } as ClassStudent["student"] });
    expect(getClassStudentDisplayName(unnamed)).toBe("Student 100234");
    expect(getClassStudentDisplayName(unnamed, { invited: "আমন্ত্রিত", withId: (id) => `শিক্ষার্থী ${id}` })).toBe("শিক্ষার্থী 100234");
  });

  it("explains why an entry is not valid", () => {
    expect(getValidationError("nadia@")).toEqual({ title: "invalidEmailTitle", description: "invalidEmail" });
    expect(getValidationError("0170")).toEqual({ title: "invalidPhoneTitle", description: "invalidPhone" });
    expect(getValidationError("01700000000")).toBeNull();
    expect(getValidationError("100234")).toBeNull();
  });
});
