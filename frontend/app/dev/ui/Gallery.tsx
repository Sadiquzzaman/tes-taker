"use client";

import LanguageSwitcher from "@/component/Layout/LanguageSwitcher";
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Combobox,
  ConfirmDialog,
  DatePicker,
  Drawer,
  EmptyState,
  ErrorState,
  FileDrop,
  FilterBar,
  IconButton,
  Input,
  Link,
  MenuIcon,
  Modal,
  PageHeader,
  Pagination,
  RadioGroup,
  SearchIcon,
  Select,
  Sheet,
  Skeleton,
  StatTile,
  StatusPill,
  Stepper,
  Switch,
  Table,
  Tabs,
  Tag,
  Textarea,
  TimePicker,
  Toast,
  type TableColumn,
} from "@/design/ui";
import { useToast } from "@/component/Toast/ToastContext";
import { useState, type ReactNode } from "react";

type Student = { id: string; name: string; roll: number; attendance: number; status: "present" | "absent" | "late" };

const STUDENTS: Student[] = [
  { id: "s1", name: "Nadia Rahman", roll: 12, attendance: 96, status: "present" },
  { id: "s2", name: "Arif Hossain", roll: 3, attendance: 81, status: "late" },
  { id: "s3", name: "তাসনিম আক্তার", roll: 27, attendance: 64, status: "absent" },
  { id: "s4", name: "Rafi Chowdhury", roll: 8, attendance: 88, status: "present" },
];

const STATUS_TONE = { present: "success", absent: "danger", late: "warning" } as const;

const COLUMNS: TableColumn<Student>[] = [
  { key: "name", header: "Name", cell: (row) => row.name, sortValue: (row) => row.name },
  { key: "roll", header: "Roll", cell: (row) => row.roll, sortValue: (row) => row.roll, align: "right" },
  {
    key: "attendance",
    header: "Attendance",
    cell: (row) => `${row.attendance}%`,
    sortValue: (row) => row.attendance,
    align: "right",
  },
  {
    key: "status",
    header: "Today",
    cell: (row) => <StatusPill tone={STATUS_TONE[row.status]}>{row.status}</StatusPill>,
  },
];

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} className="flex scroll-mt-4 flex-col gap-4">
    <h2 className="border-b border-border pb-2 text-title-sm font-semibold text-ink">{title}</h2>
    {children}
  </section>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <p className="text-caption font-medium uppercase tracking-wide text-ink-muted">{label}</p>
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </div>
);

/** The /dev/ui gallery. Sample data only. */
const Gallery = () => {
  const { triggerToast } = useToast();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [agree, setAgree] = useState(true);
  const [mode, setMode] = useState<string | null>("online");
  const [notify, setNotify] = useState(true);
  const [date, setDate] = useState("2026-10-24");
  const [time, setTime] = useState("10:30");
  const [files, setFiles] = useState([{ id: "f1", name: "syllabus-page-1.jpg", progress: 64 }]);
  const [selected, setSelected] = useState<string[]>(["s2"]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(4);
  const [overlay, setOverlay] = useState<"modal" | "drawer" | "sheet" | "confirm" | null>(null);
  const [tableState, setTableState] = useState<"rows" | "loading" | "empty">("rows");

  const rows = STUDENTS.filter((student) => student.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-8">
        <PageHeader
          title="Components"
          description="Every design/ui component in its states. Sample data only. Switch the language to check Bangla."
          breadcrumb={<Breadcrumb items={[{ label: "Dev", href: "/dev/ui" }, { label: "Components" }]} />}
          actions={<LanguageSwitcher />}
        />

        <Section id="actions" title="1 · Button, IconButton, Link">
          <Row label="Variants">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete</Button>
          </Row>
          <Row label="Sizes and states">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button leftIcon={<SearchIcon />}>With icon</Button>
          </Row>
          <Row label="IconButton and Link">
            <IconButton label="Open menu" icon={<MenuIcon />} />
            <IconButton label="Search" icon={<SearchIcon />} variant="secondary" />
            <IconButton label="Disabled" icon={<SearchIcon />} disabled />
            <Link href="/dev/ui">Inline link</Link>
            <Link href="https://example.com" external variant="plain">
              External link
            </Link>
          </Row>
        </Section>

        <Section id="inputs" title="2 · Inputs">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" placeholder="e.g. Nadia Rahman" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Phone" hint="11 digits, starting with 01" defaultValue="0170" error="Phone number must be 11 digits" />
            <Input label="Disabled" defaultValue="Can't change this" disabled />
            <Select
              label="Class"
              options={[
                { value: "9a", label: "Class 9 · Section A" },
                { value: "9b", label: "Class 9 · Section B" },
              ]}
            />
            <Combobox
              label="Subject"
              placeholder="Type to search"
              value={subject}
              onChange={setSubject}
              options={[
                { value: "phy", label: "Physics", detail: "PHY-101" },
                { value: "chem", label: "Chemistry", detail: "CHE-101" },
                { value: "ban", label: "বাংলা", detail: "BAN-101" },
                { value: "math", label: "Higher Math", detail: "MAT-201" },
              ]}
            />
            <Textarea label="Notes" hint="Only teachers see this." placeholder="Write a note" />
            <DatePicker label="Exam date" value={date} onChange={setDate} />
            <TimePicker label="Start time" value={time} onChange={setTime} />
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <Checkbox label="Send SMS to guardians" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <Checkbox label="Indeterminate" indeterminate readOnly />
              <Checkbox label="Disabled" disabled hint="Needs the SMS feature" />
            </div>
            <RadioGroup
              legend="Exam mode"
              name="mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "online", label: "Online", hint: "Students take it in the app" },
                { value: "offline", label: "On paper" },
              ]}
            />
            <Switch label="Notify me" hint="Takes effect at once" checked={notify} onChange={setNotify} />
          </div>
          <FileDrop
            label="Syllabus photos"
            accept="image/*,.pdf"
            acceptLabel="JPG, PNG or PDF"
            maxSizeMb={10}
            multiple
            items={files}
            onFiles={(added) =>
              setFiles((current) => [...current, ...added.map((file) => ({ id: `${file.name}-${file.lastModified}`, name: file.name, progress: 0 }))])
            }
            onRemove={(id) => setFiles((current) => current.filter((file) => file.id !== id))}
          />
        </Section>

        <Section id="display" title="3 · Card, StatTile, Badge, Avatar, Tag">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Students" value={1284} change={32} changeLabel="vs last month" />
            <StatTile label="Attendance today" value="92%" change={-3} changeLabel="vs yesterday" />
            <StatTile label="Absences" value={41} change={-5} higherIsBetter={false} changeLabel="vs last week" />
            <StatTile label="Live exams" value={2} />
          </div>
          <Card title="Physics 9A" description="Sunday, Tuesday · 10:00" actions={<Button size="sm" variant="secondary">Open</Button>} footer={<span className="text-body-sm text-ink-muted">Updated 5 min ago</span>}>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name="Nadia Rahman" />
              <Avatar name="তাসনিম আক্তার" size="lg" />
              <Avatar name="Broken Photo" src="/does-not-exist.png" />
              <Badge>Neutral</Badge>
              <Badge tone="primary">Primary</Badge>
              <StatusPill tone="success">Present</StatusPill>
              <StatusPill tone="warning">Late</StatusPill>
              <StatusPill tone="danger">Absent</StatusPill>
              <StatusPill tone="info">Scheduled</StatusPill>
              <Tag>Physics</Tag>
              <Tag onRemove={() => {}}>Chemistry</Tag>
            </div>
          </Card>
        </Section>

        <Section id="table" title="4 · Table (sort, filter, select, loading, empty, phone cards)">
          <FilterBar search={search} onSearchChange={setSearch} hasActiveFilters={Boolean(search)} onClear={() => setSearch("")}>
            <Select
              label="Show"
              hideLabel
              placeholder={false}
              value={tableState}
              onChange={(e) => setTableState(e.target.value as typeof tableState)}
              options={[
                { value: "rows", label: "With rows" },
                { value: "loading", label: "Loading" },
                { value: "empty", label: "Empty" },
              ]}
              fieldClassName="sm:w-40"
            />
          </FilterBar>
          <Table
            caption="Students in Physics 9A"
            columns={COLUMNS}
            rows={tableState === "empty" ? [] : rows}
            loading={tableState === "loading"}
            getRowId={(row) => row.id}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            defaultSort={{ key: "roll", direction: "asc" }}
            empty={<EmptyState title="No students yet" description="Add students or share the class link." action={<Button>Add students</Button>} />}
          />
          <Pagination page={page} pageCount={12} onPageChange={setPage} />
        </Section>

        <Section id="navigation" title="5 · Tabs, Breadcrumb, Pagination, Stepper">
          <Tabs
            tabs={[
              { key: "overview", label: "Overview", content: <Skeleton lines={3} /> },
              { key: "students", label: "Students", badge: <Badge>32</Badge>, content: <p className="text-body-sm text-ink">Students tab</p> },
              { key: "exams", label: "Exams", content: <p className="text-body-sm text-ink">Exams tab</p> },
              { key: "locked", label: "Reports", disabled: true, content: null },
            ]}
          />
          <Stepper steps={["Session", "Levels", "Classes", "Subjects", "Review"]} current={2} />
        </Section>

        <Section id="overlays" title="6 · Modal, Drawer, Sheet, Toast, ConfirmDialog">
          <Row label="Open">
            <Button variant="secondary" onClick={() => setOverlay("modal")}>Modal</Button>
            <Button variant="secondary" onClick={() => setOverlay("drawer")}>Drawer</Button>
            <Button variant="secondary" onClick={() => setOverlay("sheet")}>Sheet</Button>
            <Button variant="danger" onClick={() => setOverlay("confirm")}>Delete class…</Button>
            <Button variant="secondary" onClick={() => triggerToast({ title: "Saved", description: "Attendance for Physics 9A is saved.", type: "success" })}>
              Toast
            </Button>
          </Row>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toast tone="success" title="Saved" description="Attendance is saved." onClose={() => {}} />
            <Toast tone="error" title="Could not save" description="Check your connection and try again." onClose={() => {}} />
            <Toast tone="warning" title="SMS allowance low" description="12 SMS left this month." onClose={() => {}} />
            <Toast tone="info" title="New version" description="Refresh to update." onClose={() => {}} />
          </div>
          <Modal open={overlay === "modal"} onClose={() => setOverlay(null)} title="Publish results?" description="Students and guardians will see the marks." footer={<><Button variant="secondary" onClick={() => setOverlay(null)}>Cancel</Button><Button onClick={() => setOverlay(null)}>Publish</Button></>}>
            <p className="text-body-sm text-ink">32 students, 2 still unmarked.</p>
          </Modal>
          <Drawer open={overlay === "drawer"} onClose={() => setOverlay(null)} title="Edit class" footer={<><Button variant="secondary" onClick={() => setOverlay(null)}>Cancel</Button><Button onClick={() => setOverlay(null)}>Save</Button></>}>
            <div className="flex flex-col gap-4">
              <Input label="Class name" defaultValue="Physics 9A" />
              <Textarea label="Description" />
            </div>
          </Drawer>
          <Sheet open={overlay === "sheet"} onClose={() => setOverlay(null)} title="Mark Arif as">
            <div className="flex flex-col gap-2">
              {["Present", "Absent", "Late", "Leave"].map((choice) => (
                <Button key={choice} variant="secondary" fullWidth onClick={() => setOverlay(null)}>
                  {choice}
                </Button>
              ))}
            </div>
          </Sheet>
          <ConfirmDialog
            open={overlay === "confirm"}
            tone="danger"
            title="Delete Physics 9A?"
            description="The class, its 32 enrolments and its attendance will be deleted."
            confirmLabel="Delete class"
            onConfirm={() => setOverlay(null)}
            onCancel={() => setOverlay(null)}
          />
        </Section>

        <Section id="states" title="7 · EmptyState, Skeleton, ErrorState">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <EmptyState title="No exams yet" description="Create one in a few minutes." action={<Button size="sm">Create exam</Button>} />
            </Card>
            <Card title="Loading">
              <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton lines={4} />
              </div>
            </Card>
            <Card>
              <ErrorState description="The class list did not load." onRetry={() => {}} />
            </Card>
          </div>
        </Section>

        <Section id="shell" title="8 · AppShell, PageHeader, FilterBar">
          <p className="text-body-sm text-ink">
            The AppShell frames every signed-in page (sidebar by role, phone menu, top bar with organisation switcher, language and
            profile). PageHeader and FilterBar are at the top of this page and above the table.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default Gallery;
