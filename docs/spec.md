# Instructor — Feature Specification v1

Oct 20, 2026 · @Instructor

This document defines the 11 requested features as user stories with acceptance criteria. It is written for both developers and non-technical readers. Each organisation or solo teacher switches features on individually.

## How to read this document

Each feature is an **epic**. Each epic contains:

- a plain-language goal
- the settings an organisation can change
- numbered **user stories** with **acceptance criteria** (what must be true for the story to count as done)

A developer can build from the stories. A non-technical reader can stop at the goal and settings.

**Story format:** `ATT-03 · Title (Must)`, then "As a *role*, I want *something* so that *benefit*", then the acceptance criteria.

**Priority:**

- **Must:** needed for the first release of that feature.
- **Should:** important, can follow soon after.
- **Could:** nice to have.

**Built today** notes say what already exists in the `develop` branch, so only the gap needs building.

### Workspace types

Every account is one of two types, chosen at sign-up. The type decides the dashboard and which epics apply (see the feature-to-module map near the end).

| Type | Who | Dashboard centres on |
| --- | --- | --- |
| **Academic** | Schools, coaching centres, solo tutors | Sessions, classes/batches, subjects, syllabus, attendance, marks and GPA |
| **IELTS** | IELTS centres and solo IELTS trainers | Courses, the 4 modules (Listening, Reading, Writing, Speaking), mock tests, band scores |
| **Tertiary (future)** | Colleges and universities | Semesters, departments, credit-hour courses, CGPA, transcripts |

A solo teacher is treated as an organisation of one, so every rule below applies to them too.

Tertiary is a planned third type for when the product expands to colleges and universities. It is not in v1, and no epic below targets it yet.

### Roles

| Role | Who | Can |
| --- | --- | --- |
| Org Owner | Founder or principal | Everything, including billing and feature settings |
| Org Admin | Office or academic admin | Manage people, structure, settings, approvals and reports; review chats |
| Assistant | Office staff | Data entry (students, guardians, attendance corrections) as granted by the admin |
| Teacher | Teaching staff | Their own sections and subjects: attendance, homework, exams, marks, resources, chat |
| Class/Batch Teacher | A teacher responsible for one section | Everything a teacher can do, plus approving that section's student leave |
| Student | Learner | Check in, submit work, take exams, view their own results and resources, chat with teachers |
| Guardian | Parent or guardian | No login; receives SMS and PDF reports only |
| Platform Admin | Instructor staff | Switch features per account, manage SMS credits and storage, provide support |

## Foundations (build these first)

The pieces in this section are shared by every epic, so they come before any feature work.

### F1. Academic structure

&#91;embedded content: Academic structure · 6 levels\]

Every attendance record, mark, homework and report belongs to a student's enrolment in one session. Each year (or each coaching term) starts clean while history stays intact. IELTS workspaces use the same structure with fixed labels: Course → Batch.

**Built today:** classes with subjects and teacher–subject assignment. Sessions, sections and branches don't exist. Migration: each existing class becomes a class with one default section in a default session.

**FND-01 · Manage academic sessions (Must)** As an org admin, I want to create sessions with start and end dates so that each year or term keeps its own records.

- A session has a name, start date and end date.
- Several sessions can be active at once (coaching centres run overlapping terms); one is marked as the default.
- Closing a session makes its attendance, marks and homework read-only. Only the Owner can reopen it.

**FND-02 · Classes and sections (Must)** As an org admin, I want to create classes/courses and split each into sections/batches so that teachers and students are grouped the way we teach.

- A class has a name and its subjects. A section has a name, an optional room, an optional shift (Morning/Day/Evening) and a class/batch teacher.
- A class must have at least one section.
- Teachers are assigned per section + subject.

**FND-03 · Rename levels (Should)** As an org owner, I want to rename "Class" and "Section" so that the app uses our words.

- The labels are chosen once per org, in Bangla and English: Class/Section, Course/Batch, or custom.
- The labels appear everywhere in the web app, the mobile app, SMS and PDFs.

**FND-04 · Enrol students (Must)** As an org admin or assistant, I want to add students to a section for a session, one by one or by CSV, so that they appear in attendance, homework and exams.

- The CSV template has: name, phone or email, section, roll number, guardian 1 and 2 (name, relation, phone).
- An import preview shows errors per row before saving.
- A student can belong to only one section per class per session.

**FND-05 · Promote students (Should)** As an org admin, I want to move a section's students into a section of the next session in one action so that the new year is set up quickly.

- The admin chooses the target session, class and section, and can untick students who are held back or leaving.
- Old enrolments and their data are kept and stay viewable.

**FND-06 · Branches (Could)** As an org owner with several campuses, I want branches so that each branch admin sees only their own students and reports.

- A branch admin's lists and reports are filtered to their branch.
- The Owner sees all branches and a combined report.

**FND-19 · Subject classes and electives (Must)** As an org admin, I want each subject taught to a section to be its own subject class, with a choice of which students take optional subjects, so that electives and religion subjects work.

- A **subject class** = section + subject + session, for example "Class 6-A · ইসলাম শিক্ষা · 2026". It is created when a subject is added to a section.
- **Who takes it:** by default every student in the section. For optional subjects (religion, electives) the admin or class teacher picks the students.
- Attendance, homework, exams, marks, behaviour ratings, chat, syllabus progress, routine and resources all belong to a subject class, so a student sees only the subjects they take.
- **Tertiary-ready:** this is the same model colleges and universities need later, where students register course by course (Tertiary, future).

### F2. Feature switches per account

**Built today:** plan feature flags exist, but only for individual teachers.

**FND-07 · Turn features on per account (Must)** As a platform admin, I want to turn each epic on or off for an organisation or solo teacher so that every customer gets exactly what they bought.

- Every epic in this document and its sub-features can be switched on or off per account. Limits are set per account: students, teachers, SMS credits and storage (GB).
- A switched-off feature is hidden in the web and mobile menus.
- If it is called anyway, the server refuses it and the app shows a message that depends on who is asking:
  - **Org owners and admins** see "This feature is one upgrade away — unlock it today!" with an upgrade button.
  - **Everyone else** sees "Ask your admin to unlock this."
- Changes take effect at the user's next page load, with no re-login needed.

**FND-08 · Upgrade prompt (Should)** As an org owner, I want to see what a locked feature does and how to get it so that I can upgrade without contacting support.

- Locked features show in a "More features" page with a short description and a "Request this feature" button.
- The request notifies the platform admin.

### F3. Guardians

Guardians have no login. They receive SMS and PDF reports.

**FND-09 · Guardian contacts (Must)** As an admin, assistant or teacher, I want to store up to 2 guardians per student so that alerts and reports reach the family.

- Each guardian has a name, a relation (Father, Mother or Other) and a Bangladeshi mobile number, validated as 01XXXXXXXXX.
- One guardian is marked as primary.
- Guardians are entered by CSV import or by an admin, assistant or the student's teacher. Students cannot add or edit guardians.
- Every change is recorded: who changed it and when.

**FND-10 · SMS language (Should)** As an org admin, I want guardian SMS in Bangla or English so that families can read them.

- The language is set per org, with an option to override it per student.
- Bangla SMS costs more credits, because one SMS holds 70 Bangla characters versus 160 English. The credit estimate shows this before sending.

### F4. Grading scale

**FND-11 · Organisation grading scale (Must)** As an org admin, I want one grading scale that every mark uses so that results look the same everywhere.

- Percentage = marks obtained ÷ total marks × 100. The grade is the band the percentage falls in.
- Marks are shown with the grade, for example "64/80 · 80% (A+)".
- The default scale is Bangladesh national. Bands are editable per org, for example for English-medium schools. Changing the scale recalculates grades but never changes raw marks.

| From | To | Grade | GPA |
| --- | --- | --- | --- |
| 80% | 100% | A+ | 5.00 |
| 70% | 79.99% | A | 4.00 |
| 60% | 69.99% | A- | 3.50 |
| 50% | 59.99% | B | 3.00 |
| 40% | 49.99% | C | 2.00 |
| 33% | 39.99% | D | 1.00 |
| 0% | 32.99% | F | 0.00 |

### F5. Notifications and SMS credits

**FND-12 · Notification channels (Must)** As a user, I want reminders and alerts in the app, by email or by SMS so that I don't miss anything.

- **In-app:** a bell icon on the web, plus push notifications on the mobile app. Free.
- **Email:** free.
- **SMS:** uses the org's credits. Users choose their own channels; guardians always get SMS.

**FND-13 · SMS credits: monthly allowance plus top-ups (Must)** As an org owner, I want a monthly SMS allowance from my plan, and top-ups when I need more, so that costs are predictable.

- **Monthly allowance:** each plan includes a number of SMS per month. It resets at the start of each billing month. *Proposed:* unused allowance does not carry over.
- **Top-ups:** extra credits bought on top of the plan. They are added by the platform admin; self-serve top-up through payment is a Should. *Proposed:* top-up credits carry over until used.
- Sending uses the monthly allowance first, then top-up credits. Each SMS segment deducts one credit.
- The owner is warned in-app and by email when 10% of the month's credits (allowance + top-ups) is left.
- At zero credits, SMS stop and each one is logged as "Not sent — no credit". In-app and email messages still go out.

**FND-14 · Message log (Should)** As an org admin, I want a log of every SMS and email sent so that I can answer "did the parent get it?"

- The log shows recipient, channel, message, time, status (sent, delivered, failed or no credit) and credits used.
- It can be filtered by date, student and type.

### F6. File uploads and storage

**FND-15 · Upload and compress (Must)** As a user, I want to upload files up to 20 MB without worrying about size so that I can submit phone photos and PDFs.

- Allowed types: PDF, JPG, PNG, HEIC, DOC/DOCX, and (resource hub only) MP4, MP3 and PPTX.
- Images are resized to at most 1600 px on the long side and saved as WebP at about 80% quality. PDFs are optimised. Word files are stored as-is.
- Compression happens before the file is stored in S3. The user sees progress and the final size.
- Video follows the resource hub rules (Epic 8).

**FND-16 · Storage quota (Must)** As an org owner, I want to see storage used against my plan so that uploads don't fail without warning.

- Usage is shown by type (homework, resources, video).
- Uploads are blocked at 100% with a clear message, and a warning shows at 90%.
- The quota is total storage held, not a monthly allowance: space frees up only when files are deleted. (SMS works differently: a monthly allowance plus top-ups, FND-13.)

### F7. Apps and languages

**FND-17 · Web and mobile apps (Must)** As a user, I want the same features on the web and the mobile app so that I can work from either.

- Check-in by location + selfie (Epic 1) and push notifications are mobile-only. Everything else works on both.

**FND-18 · Bangla and English (Must)** As a user, I want to switch the app between Bangla and English so that everyone can use it comfortably.

- Each user chooses a language, and the org sets the default.
- The choice covers all screens, emails and PDFs. Dates and numbers follow it (২০২৬ / 2026).
- User-entered content (questions, notes) is not translated.

## Epic 1 — Attendance

**Goal:** record who is at the institution and who attends each class, for students and teachers, and tell guardians the same day.

**Built today:** nothing.

There are two independent parts, and an org can use either or both:

- **Daily presence:** check-in and check-out at the institution, by ZKTeco device *or* by app button (never both in one org).
- **Class attendance:** the teacher marks each student in a class, either per class session or once a day, as the org chooses.

&#91;embedded content: Daily student status · 4 outcomes\]

Late and absent come from daily presence when it is on, otherwise from class attendance. Leave always comes from an approved or pending leave application.

### Settings (per org)

| Setting | Options | Default |
| --- | --- | --- |
| Daily presence method | Off / ZKTeco / App | Off |
| App check-in radius | 25–1000 m around a pin on the map | 100 m |
| Selfie at app check-in | On / Off | Off |
| Entry time | One time per org; can be overridden per shift or section; separate time for teachers | 9:00 AM |
| Class attendance | Off / Per class session / Once per day | Per class session |
| Weekly off days | Any days | Friday |
| Guardian SMS | Late / Absent / Leave, each on or off | All on |

### Stories

**ATT-01 · Choose the attendance setup (Must)** As an org admin, I want to choose the daily presence method and class attendance mode so that the system matches how we work.

- Only one daily presence method can be active.
- Switching method mid-session asks for confirmation. Records already saved are kept.

**ATT-02 · Register ZKTeco devices (Must)** As an org admin, I want to add our ZKTeco machines and link each device user to a student or teacher so that punches land on the right person.

- A device has a name, serial number, branch and connection details.
- Device users are mapped to students or teachers by roll number or employee ID, in bulk by CSV, with a list of unmapped device users.
- *Developer note:* most ZKTeco machines sit on the local network. Plan for push mode (ADMS) where the device supports it, and otherwise a small sync agent installed on a PC at the institution.

**ATT-03 · Hourly ZKTeco import (Must)** As an org admin, I want punches imported every hour so that attendance is up to date without manual work.

- Punches are imported every hour. The first punch of the day is the check-in and the last is the check-out. Duplicate punches are ignored.
- A "Sync now" button runs an import on demand.
- If two imports in a row fail, admins get an in-app and email alert naming the device.

**ATT-04 · App check-in within a radius (Must)** As a student or teacher, I want to tap "Check in" in the mobile app when I arrive so that my attendance is recorded.

- The button works only inside the radius. Outside it, the app shows the distance ("You are 340 m away").
- GPS accuracy must be 50 m or better; otherwise the app asks the user to wait or move outdoors.
- One check-in and one check-out per day. The time is taken from the server, not the phone.

**ATT-05 · Selfie with app check-in (Must when the setting is on)** As an org admin, I want a selfie with each app check-in so that check-ins can't be faked from home.

- The selfie must be taken live with the front camera; gallery uploads are not allowed. It is compressed and stored with the record.
- Android mock-location apps are detected. The check-in is still saved but marked "Suspicious" for the admin.
- Admins can view the selfie and location for any check-in.

**ATT-06 · Mark late (Must)** As an org admin, I want anyone who checks in after entry time marked Late, with minutes late, so that punctuality is tracked.

- Late = check-in time after the applicable entry time (section or shift time if set, otherwise the org time).
- For students, the guardian SMS is sent at once (ZKTeco: at the hourly import). Example: "Rahim (Class 8-A) arrived late at 9:24 AM on 21 Oct."

**ATT-07 · Teacher marks class attendance (Must)** As a teacher, I want a roster for my section and subject where everyone starts as Present and I tap the exceptions so that attendance takes under a minute.

- The statuses are Present, Absent, Late and Leave.
- Students with approved leave are pre-filled as Leave. If daily presence is on, students with no check-in are pre-filled as Absent.
- The teacher can edit until midnight. After that, only an admin can edit, and must give a reason.
- Works offline in the mobile app and syncs when the connection returns.

**ATT-08 · Class photo as proof (Should)** As a teacher, I want to attach one or more class photos to an attendance record so that the admin can verify it.

- Up to 3 photos per record, compressed (FND-15).
- In v1, photos are proof only; there is no automatic face recognition (see Future).

**ATT-09 · Student leave application (Must)** As a student (or a teacher or admin acting for them), I want to apply for leave with dates and a reason so that my absence is excused.

- An application has from and to dates, a reason and an optional attachment (for example a doctor's note).
- The guardian gets an SMS as soon as the leave is applied for.
- The class/batch teacher approves or rejects it with a comment, and the student is notified.
- Approved days show as Leave. Rejected days fall back to the normal Present/Late/Absent rules.

**ATT-10 · End-of-day absent alert (Must)** As an org admin, I want students with no check-in, no class presence and no leave marked Absent at 11:59 PM with a guardian SMS so that families know the same day.

- Runs at 11:59 PM Bangladesh time every working day.
- It skips weekly off days and holidays from the academic calendar (Epic 9).
- Example SMS: "Rahim (Class 8-A) was absent today, 21 Oct."

**ATT-11 · Teacher attendance and leave (Must)** As an org admin, I want teachers to check in the same way as students, and to apply for leave that I approve, so that staff attendance is recorded.

- Teachers use the org's daily presence method, with their own entry time.
- Teacher leave is approved by an Org Admin or the Owner.
- No guardian SMS. Admins get a daily summary of late and absent teachers.

**ATT-12 · Corrections with a trail (Must)** As an org admin, I want to correct any attendance record with a reason so that mistakes can be fixed without hiding changes.

- Each correction stores the old value, new value, who made it, when, and the reason.
- Correcting Absent to Present after the SMS was sent offers to send a correction SMS.

**ATT-13 · Attendance reports (Must)** As an admin or teacher, I want daily and monthly attendance reports so that I can spot problems and print registers.

- **Daily summary per section:** present, late, absent and on leave, with counts and names.
- **Monthly register:** a student × day grid, exportable to PDF and Excel.
- **Attendance % per student:** feeds Performance (Epic 3).
- **Teacher attendance report:** for admins only.

**ATT-14 · Repeated absence alert (Should)** As a class teacher, I want to be alerted when a student is absent 3 days in a row so that I can follow up early.

- The threshold is configurable per org; the default is 3 days in a row.
- The alert goes to the class/batch teacher in-app.

## Epic 2 — Homework

**Goal:** teachers assign homework, students submit files or typed answers, and teachers score and comment, including for work done on paper.

**Built today:** nothing. The exam builder (Epic 4) is reused to write homework questions.

### Settings (per org)

| Setting | Options | Default |
| --- | --- | --- |
| Late submission | Allowed and marked late / Not allowed | Allowed |
| Late penalty | None / X% off per day / Fixed X% | None |
| Resubmissions | 0–3 | 1 |
| Max file size per upload | Up to 20 MB, compressed (FND-15) | 20 MB |
| Max files per submission | 1–10 | 5 |

### Stories

**HW-01 · Create homework (Must)** As a teacher, I want to create homework with instructions, attachments, total marks and a due date so that students know exactly what to do.

- Fields: title, instructions (rich text, Epic 4 editor), attachments, subject, section(s) or selected students, total marks, due date and time.
- Optional: a syllabus topic from Epic 6, so performance can be shown by topic.
- Submission type: file upload, typed answer, questions from the builder (auto-scored where possible), or "on paper" (nothing to upload).
- The homework can be saved as a draft, published now, or scheduled to publish later.

**HW-02 · Students are notified (Must)** As a student, I want to be notified when homework is assigned and 24 hours before it's due so that I don't miss it.

- Notifications go out in-app and by push. Email is optional per user (FND-12).
- Homework appears in the student's to-do list, sorted by due date.

**HW-03 · Submit homework (Must)** As a student, I want to upload photos or files, or type my answer, so that I can hand in work from my phone.

- Phone photos are accepted; several photos can be combined into one PDF automatically.
- After the due date, the submission is saved with a "Late" tag and how late it was.
- The student can resubmit up to the org limit until the teacher has scored it. Earlier versions are kept for the teacher.

**HW-04 · Review and score (Must)** As a teacher, I want to open each submission, score it and leave feedback so that students learn from it.

- The teacher can view the file in the browser, draw or annotate on images and PDFs (Should), enter a score out of the total, and write a comment.
- The score is shown with the grade from FND-11, for example "8/10 · 80% (A+)". Any late penalty is applied automatically and shown separately.
- The teacher can return work for redo, which allows one more submission even beyond the limit.
- Scores stay hidden from students until the teacher clicks "Publish scores".

**HW-05 · Score work done on paper (Must)** As a teacher, I want to enter scores and remarks for a whole section in one grid so that paper homework still counts.

- A grid of students × score + remark, with keyboard entry and bulk "not submitted".
- An optional 1–5 rating for neatness, effort and on-time, which feeds the class-behaviour part of Epic 3.

**HW-06 · Homework overview (Must)** As a teacher, I want to see for each homework who submitted, who is late, who is missing and what is scored so that I can chase missing work.

- Shows counts and lists, with a "Remind missing students" button (in-app and push).
- An optional SMS to guardians of students who didn't submit uses org credits.

**HW-07 · Plagiarism check on submissions (Should)** As a teacher, I want each typed or text-based submission checked against classmates' submissions so that copying is visible.

- See Epic 10; the result shows on the review screen as a similarity %.

## Epic 3 — Performance & Reporting

**Goal:** turn exams, homework, attendance and class behaviour into one score per student per subject, and produce class dashboards and parent reports in one click. This epic merges requested features 3 (Class Performance Tracking) and 10 (One-Click Performance Analytics).

**Built today:** online exam results, a grading roster and basic teacher dashboard widgets. There are no weights, no offline marks, no student history and no parent reports.

### How the score is calculated

Each component becomes a percentage. The admin sets each component's weight per class, and the weights must add up to 100%.

**Decision: when the score is calculated**

- **Live to date.** The student page and dashboards recalculate whenever a teacher records or changes marks, homework, attendance or behaviour. Opening them at any time shows performance up to that moment.
- **Frozen per term.** When a term's report cards are generated, that term's scores are saved as a snapshot. Later changes don't alter an issued report card; a corrected card must be regenerated and is kept as a new version.
- **Traced.** Every change that affects a score records who made it, when, and the old and new values. The responsible teacher, the org admin and the org owner can see this history.

| Component | Percentage = | Example weight |
| --- | --- | --- |
| Exams | Average % across exams counted for the term (online and offline) | 50% |
| Homework | Average % across scored homework, after late penalties | 20% |
| Attendance | (Present + Late days) ÷ (working days − approved leave days) | 20% |
| Class behaviour | Average of the teacher's behaviour ratings, as % | 10% |

Example: exams 78%, homework 90%, attendance 95%, behaviour 80%. The overall score is 0.5×78 + 0.2×90 + 0.2×95 + 0.1×80 = **84% (A+)**. A component with no data yet is left out, and the remaining weights are scaled up to 100%.

### Stories

**PRF-01 · Set component weights (Must)** As an org admin, I want to set the weights of exams, homework, attendance and behaviour per class so that the score reflects our policy.

- Weights must total 100%. A component can be set to 0%.
- Changing weights recalculates scores and is recorded in the audit log.

**PRF-02 · Terms (Must)** As an org admin, I want to split a session into terms (for example 1st Term, Half-yearly, Final) and choose which exams count toward each so that report cards match the school calendar.

- A term has a name, a date range and a list of included exams.
- Coaching centres can keep a single term for the whole session.

**PRF-03 · Enter marks for paper exams (Must)** As a teacher, I want to enter marks for exams taken on paper so that offline exams count toward performance.

- Create an offline exam with a name, subject, section, date and total marks, then enter marks in a student grid. Absent students can be marked.
- Optional marks per part (for example MCQ / Written / Practical), with totals computed automatically.
- Marks can be imported from an Excel template.

**PRF-04 · Rate class behaviour (Must)** As a teacher, I want to rate each student's participation, discipline and attentiveness from time to time so that behaviour counts in the score.

- A grid of students × criteria, each rated 1–5, with an optional remark.
- The criteria list is editable per org.
- Ratings can be entered as often as the teacher likes; the term average is used.

**PRF-05 · Student performance page (Must)** As a teacher or admin, I want one page per student with subject scores, trend and history so that I can understand a student in a minute.

- The page shows:
  - the overall score and GPA
  - each subject's score and grade, with each component's %
  - a trend line per term
  - attendance %, homework on-time %, behaviour average
  - every exam and homework with its mark
- History from earlier sessions is reachable from the same page.
- Students see their own page, but without other students' data or class rank unless the org enables it.

**PRF-06 · Strengths and weaknesses (Must)** As a teacher, I want each student's strongest and weakest subjects and topics so that I know where to help.

- Topics come from syllabus tags on questions and homework (Epics 4 and 6).
- The page shows the top 3 strongest and 3 weakest topics, with the % and the number of items each is based on. A topic needs at least 3 scored items to appear.

**PRF-07 · Class dashboard (Must)** As a teacher, I want a dashboard per section and subject so that I see how the class is doing at a glance.

- The dashboard shows:
  - average, highest and lowest score
  - grade distribution (how many A+, A, … F)
  - trend across exams
  - homework submission rate and attendance rate
  - an "At risk" list: students below 40%, below 75% attendance, or with 3+ missing homework
- The at-risk thresholds are editable per org.

**PRF-08 · Organisation dashboard (Should)** As an org owner, I want institution-wide numbers by class, section, subject and teacher so that I can compare and act.

- Shows average scores, attendance trends, homework completion and syllabus coverage (Epic 6), filtered by session, term and branch.

**PRF-09 · Report card and parent report (Must)** As a teacher or admin, I want to generate a printable report card per student per term, for one student or a whole section at once, so that parents understand progress.

- The report card includes:
  - the org logo and name
  - student details
  - each subject's marks with grade and GPA, plus overall GPA
  - attendance %
  - behaviour summary
  - strengths and weaknesses
  - teacher's remark and principal's remark (editable before printing)
- It is available in Bangla or English.
- A section of 60 students is generated in under 30 seconds, as one PDF or a ZIP of PDFs.
- **Share with guardians:** an SMS with a short summary and a secure link to the PDF. The link is unique, needs no login and expires after 30 days.

**PRF-10 · Merit position (Should)** As an org admin, I want students' positions in the section and class so that we can publish merit lists.

- The position is based on the overall score, with ties broken by exam %.
- Showing position on report cards and to students is an org setting.

## Epic 4 — Question & homework authoring

**Goal:** make writing questions fast and reusable, including maths and science, and produce print-ready papers.

**Built today (keep):**

- A Word-like rich text editor
- Maths formulas, chemistry structures, geometry figures and function graphs
- Images in questions and options
- Speech-to-text dictation
- Multi-step exam wizard with MCQ, multiple response, true/false, fill-in-the-blanks, matching, essay and passage questions
- Basic PDF export

The stories below cover only what's missing.

**QA-01 · Question bank (Must)** As a teacher, I want every question I write saved to a searchable bank so that I can reuse it in exams and homework.

- Every saved question is tagged with class, subject, chapter and topic (from the syllabus in Epic 6), difficulty (Easy, Medium or Hard) and type.
- The bank can be filtered by any tag and searched by text.
- Questions can be selected from the bank into an exam or homework, and "Pick 10 random Medium questions from Chapter 3" is supported.
- **Visibility:** private to the teacher, or shared with the org. Org admins can see all shared questions.
- The bank size is limited by plan (FND-07).

**QA-02 · Homework uses the same builder (Must)** As a teacher, I want to build homework questions with the same editor and question types so that I don't learn two tools.

- In "Homework mode", proctoring and timers are hidden; a due date is shown instead.
- Auto-scored questions score themselves, and written answers go to manual review (HW-04).

**QA-03 · Formula and science templates (Should)** As a teacher, I want one-click templates for common formulas so that I don't build them symbol by symbol.

- **Template groups:** algebra (quadratic formula), trigonometry (identities), statistics (mean, variance, standard deviation), physics (motion, Ohm's law, energy), chemistry (reaction arrows, states, equilibrium, balancing).
- Templates are inserted as editable formulas.
- A geometry shape library (triangle, circle, polygon) is available with labels.

**QA-04 · Create a question set by voice (Should)** As a teacher, I want to say something like "Make 10 MCQs on photosynthesis for Class 8, in Bangla" so that a draft set is ready for me to edit.

- Works in Bangla and English speech.
- The voice request is turned into text, then an AI drafts the questions into the editor as a **draft**. The teacher must review and save each question; nothing is published automatically.
- Draft questions are tagged with the subject and topic named in the request.
- AI usage is limited per plan (for example drafts per month), because each request has a running cost.
- Today's word-by-word dictation stays available.

**QA-05 · Print-ready question papers (Must)** As a teacher, I want a print-ready PDF of a question paper so that I can run paper exams with the same questions.

- **Layout:** A4 or Legal, one or two columns.
- **Header:** org logo and name, exam name, class, subject, time and full marks.
- Bangla fonts are embedded, so the text never breaks.
- **Options:** shuffled sets (Set A/B/C with different question and option order), a separate answer key, and an OMR-friendly MCQ answer sheet (Could).
- Formulas, figures and chemistry structures print sharply.

**QA-06 · Import questions from Word or Excel (Should)** As a teacher, I want to import existing questions from a Word file or an Excel template so that I don't retype my old papers.

- **Excel:** a fixed template (question, options, answer, marks, tags).
- **Word:** numbered questions with lettered options are detected.
- A preview with errors is shown before import, and everything imports into the question bank.

**QA-07 · Typing Bangla in formulas (Should)** As a Bangla-medium teacher, I want Bangla text and digits inside formulas so that papers match the textbook.

- Bangla digits and words can be used in the formula editor and in printed PDFs.

## Epic 5 — AI-proctored exams

**Goal:** run online exams where the student's device helps detect suspicious behaviour, and give teachers evidence they can trust and act on.

**Built today:** join by link or code, permission check, timer, autosave, auto-submit, and browser and camera checks in the student's browser:

- tab switch, fullscreen exit, refresh, copy-paste, idle
- developer tools, second screen
- face missing, multiple faces, looking away
- phone, voice

The system also keeps a violation count per student and does auto-disqualification. The stories below close the gaps found in the codebase review. Fixing the review's loopholes (deadline enforcement, matching shuffle, edit after submit) is a precondition.

**PRO-01 · Proctoring level per exam (Must)** As a teacher, I want to choose Off, Light or Strict proctoring for each exam so that a quick class quiz doesn't need a camera.

- **Off:** no checks.
- **Light:** browser checks only.
- **Strict:** browser checks + camera, microphone and phone detection.
- Individual checks can be switched off within a level.
- The levels offered are limited by the account's plan (FND-07).
- The student sees which checks are active before starting.

**PRO-02 · Auto-disqualification is a choice (Must)** As a teacher, I want auto-disqualification off by default, with a threshold I set, so that false alarms in noisy rooms don't fail students.

- When it's on, the teacher sets which flags count and the threshold (for example 5 high-severity flags).
- Students get a warning at 60% of the threshold.

**PRO-03 · Live monitor for teachers (Must)** As a teacher, I want a live screen showing every student taking my exam so that I can watch and step in.

- A tile per student shows:
  - status (Not started, Writing, Submitted, Disconnected)
  - time left
  - number of flags and the latest flag, with a colour for risk
- Clicking a tile opens the flag timeline.
- The teacher can send a warning message to one student, or end one student's exam with a reason.
- An org admin can open the monitor for any exam in the org.

**PRO-04 · Evidence snapshots (Should)** As a teacher, I want a webcam snapshot saved when a camera-based flag fires so that I can see what happened.

- At most 1 snapshot per flag type per minute, compressed, kept for 90 days, then deleted automatically.
- Students are told before the exam that snapshots may be taken.

**PRO-05 · Review and overturn (Must)** As a teacher, I want to review a disqualified or flagged student and reinstate them, allow a retake, or confirm the result so that wrong decisions can be fixed.

- Every review records who decided, the decision and the reason, and the student is notified.

**PRO-06 · Integrity report (Should)** As an org admin, I want an integrity report per exam and per student, as a PDF, so that I can show families or management what happened.

- **Per exam:** a summary of flags by type and the students with the most flags.
- **Per student:** a flag timeline with snapshots and the teacher's decision.

**PRO-07 · Lost monitoring is visible (Must)** As a teacher, I want to know when a student's monitoring stops (script blocked, camera turned off, connection lost) so that silence isn't mistaken for good behaviour.

- If no signal comes for 60 seconds, the student is marked "Monitoring lost" on the live screen and in the report.

**PRO-08 · Suspicious activity alerts (Should)** As a teacher, I want an in-app or push alert when a student crosses a risk level during an exam so that I don't need to watch the screen constantly.

- The risk level is set per exam.
- Alerts are grouped so that a teacher gets at most 1 per student per 5 minutes.

**PRO-09 · Low-bandwidth mode (Should)** As a student on a weak connection, I want answers saved even when the internet drops so that I don't lose work.

- Answers are stored on the device and sent when the connection returns.
- The screen shows "Saved on device" or "Saved to server".
- The final submit still respects the server deadline, with 60 seconds of grace.

## Epic 6 — Syllabus digitisation & tracking

**Goal:** turn a syllabus PDF into a checklist of chapters and topics, let teachers log what they taught after each class, and show admins how far each section has progressed against plan.

**Built today:** nothing.

The syllabus is the topic list that question tags (QA-01), homework (HW-01) and strengths/weaknesses (PRF-06) all use. Build it before those features rely on topics.

**SYL-01 · Upload and digitise a syllabus (Must)** As an org admin or teacher, I want to upload a syllabus PDF and get an editable list of chapters and topics so that I don't type it by hand.

- Accepts typed or scanned PDFs, and photos, in Bangla, English or mixed.
- Text is read from the file (with scanned-page recognition for scans), and AI proposes a structure: subject → chapter → topic, with any marks or class counts printed in the syllabus.
- The result opens as a **draft** next to the original PDF. The user edits, merges, splits and reorders, then publishes. Nothing is used until it is published.
- If reading fails or confidence is low, the affected parts are highlighted for manual entry.

**SYL-02 · Build or edit a syllabus by hand (Must)** As a teacher, I want to create or edit the topic list manually so that I can work without a PDF.

- Add chapters and topics, drag to reorder, copy a syllabus from another class or session.
- A published syllabus can be edited. Changes keep the progress already logged against existing topics.

**SYL-03 · Plan dates (Should)** As a teacher or admin, I want to set planned dates or weeks per chapter so that the system can tell whether a section is ahead or behind.

- Either a planned completion date per chapter, or the number of classes per topic.
- Status per section and subject: On track, Behind by X days, or Ahead.

**SYL-04 · Lesson log after each class (Must)** As a teacher, I want to log in a few taps which topics I covered after a class so that syllabus progress updates itself.

- After a scheduled class ends (Epic 9), the teacher gets a prompt: "What did you cover in Bangla — Admission Batch 1?"
- The teacher picks topics and marks each Started or Completed, with an optional note and an optional attachment.
- Logs can also be added for unscheduled classes.

**SYL-05 · Progress per section (Must)** As a teacher, I want to see the syllabus with each topic marked Not started, In progress or Completed so that I know what's left.

- Completion % is shown per subject and per chapter.
- Pending topics are listed in order.
- Students see the same view, read-only, so they know what's been covered.

**SYL-06 · Admin oversight (Must)** As an org admin, I want a coverage dashboard for all sections, subjects and teachers so that I can find who is behind.

- A table of section × subject with teacher, completion %, plan status and last log date.
- Filters: branch, class, teacher, "behind only".
- An alert lists teachers with no lesson log for 7 days on a subject they teach (Should).

## Epic 7 — Communication (group and private chat)

**Goal:** one safe place for class discussion and one-to-one teacher–student messages, which admins can supervise openly.

**Built today:** subject discussion boards (posts and comments with attachments) per class subject, and private teacher–student conversations, stored in MongoDB. Messages are not real-time, there is no admin access, and there is no moderation.

**Rules:**

- Students can message teachers, never other students privately.
- Guardians are not in chats.
- Every chat screen shows: "Messages may be reviewed by \[Org name\] administrators."

**COM-01 · Group chat per section and subject (Must)** As a teacher, I want a group chat for each section + subject I teach so that the class can discuss in one place.

- Created automatically for each teacher-assigned section + subject. Members = enrolled students + assigned teachers.
- Text, images, files (FND-15), voice notes (Should) and replies to a message are supported.
- Teachers can pin messages, turn on "Only teachers can post" (announcement mode), and delete any message.
- Every post has its own comment thread, where students and teachers in the group discuss that post. This includes posts made in announcement mode.
- The existing discussion boards stay for longer threads and move into the same space as a "Discussions" tab.

**COM-02 · Private teacher–student chat (Must)** As a student, I want to message my subject teacher privately so that I can ask questions I won't ask in a group.

- A student can start a chat only with teachers who teach them.
- A teacher can start a chat with any of their students.
- Read receipts and typing indicators are Should.

**COM-03 · Real-time delivery and notifications (Must)** As a user, I want messages to arrive instantly with a notification so that conversations flow.

- Messages appear in under 2 seconds when online, with push on mobile and a bell on the web.
- Unread counts show per chat.
- Each user can mute a group.
- **Teacher quiet hours (Should):** for example no student pings after 10 PM; messages wait until morning.

**COM-04 · Administrator access (Must)** As an org admin, I want to open any group or private chat in my organisation when needed so that I can handle complaints and keep students safe.

- Only Owner and Org Admin roles have this access. Every opening is logged (who, which chat, when, reason) and the log is visible to the Owner.
- Admins read without being visible as a participant, but the notice in the rules above is always shown to users.
- Admins can delete a message, mute a user in a chat for a period, or close a chat.

**COM-05 · Report a message (Should)** As a student or teacher, I want to report an abusive or inappropriate message so that an admin reviews it.

- Reported messages go to an admin queue with the context (5 messages before and after).

**COM-06 · Data retention (Should)** As an org owner, I want chats kept for the session and archived after it closes so that storage stays under control.

- When a session closes, its chats become read-only.
- Deletion after N months is set per org (default: never).

## Epic 8 — Resource hub

**Goal:** one organised library of notes, slides, documents and recorded classes per class and subject, which students can find in seconds.

**Built today:** nothing, apart from file upload infrastructure.

**RES-01 · Upload a resource (Must)** As a teacher, I want to upload notes, slides, PDFs, audio and recorded classes, or add a link, so that students have everything in one place.

- **Types:** PDF, DOC/DOCX, PPT/PPTX, images, MP3, MP4, and links (YouTube, Google Drive, any URL).
- **Details:** title, description, class, subject, chapter/topic (Epic 6), and section(s) it is shared with.
- Files over 20 MB are allowed only for video (RES-02). Everything else follows FND-15.

**RES-02 · Upload recorded classes to our storage (Must, limited by plan)** As a teacher, I want to upload class recordings so that students can watch them without leaving the app.

- Video upload is available only if the plan includes video storage. Each upload counts against the org's storage quota (FND-16).
- The maximum per video is set per plan (for example 2 GB).
- Uploads resume after a dropped connection.
- After upload, the video is converted to 720p streaming quality to save space and data. The original is not kept. Students stream it in the app.
- Plans without video storage show "Add a YouTube or Drive link instead".

**RES-03 · Organise the library (Must)** As a teacher, I want resources grouped by subject → chapter → topic, with my own folders and tags, so that the library stays tidy.

- Views: by syllabus, by folder, and newest first.
- Resources can be moved between folders, renamed, archived or deleted.
- Archived items are hidden from students but kept.

**RES-04 · Student access (Must)** As a student, I want to browse and search resources for my classes, filtered by subject and type, so that I find what I need quickly.

- Students see only resources shared with their sections.
- Search covers titles and descriptions, and text inside PDFs (Should).
- "New" badges mark resources the student hasn't opened yet.

**RES-05 · Download control (Should)** As a teacher, I want to choose whether a resource can be downloaded or only viewed so that paid materials are harder to share.

- "View only" hides the download button and adds a watermark with the student's name to PDFs.
- This discourages copying but cannot fully prevent screenshots.

**RES-06 · Usage insights (Should)** As a teacher, I want to see who opened a resource and how much of a video they watched so that I know if students are using it.

- Per resource: number of students who opened it, and a list of who has not.
- For videos: the average % watched.

## Epic 9 — Calendar, routine and reminders

**Goal:** one academic calendar holding the weekly class routine, exams, meetings and holidays, and reminding teachers and students before each event.

**Built today:** a calendar widget on the teacher dashboard showing exam dates. There is no routine, no events and no reminders.

**Example from the brief:** Rabbi Sir teaches Bangla to Admission Batch 1 at 2:00 PM. He has reminders at 12:00 PM, 1:00 PM and 1:30 PM. He gets push notifications at 12:00 and 1:00 and an SMS at 1:30, and the students get a push at 1:30.

**CAL-01 · Weekly class routine (Must)** As an org admin, I want to build a repeating weekly routine (day, time, section, subject, teacher, room) so that everyone knows when classes happen.

- Each routine slot repeats weekly within the session dates. Exceptions for one date (cancel, move, change teacher) don't change the rest of the routine.
- The routine is built in a week grid, or imported by Excel.
- Each teacher, student and section gets their own routine view, on web and mobile.

**CAL-02 · Clash warnings (Must)** As an org admin, I want to be warned when a teacher, room or section is booked twice at the same time so that the routine has no impossible slots.

- Saving a clashing slot shows what it clashes with. The admin can still save after confirming, and the clash is then marked in the grid.

**CAL-03 · Other events (Must)** As an org admin or teacher, I want to add exams, meetings, parent meetings and other activities with date, time, place and attendees so that the calendar is complete.

- Online exams created in Epic 5 and offline exams from PRF-03 appear automatically.
- **Attendees:** sections, specific teachers, specific students, or the whole org.

**CAL-04 · Holidays and off days (Must)** As an org admin, I want to mark holidays and closures so that classes, attendance and absence SMS are skipped those days.

- Single days or ranges, with an optional note.
- Weekly off days come from the attendance settings (Epic 1).
- Bangladesh public holidays can be loaded each year as a starting list (Should).

**CAL-05 · Multiple reminders per event (Must)** As a teacher, I want several reminders for one class at times I choose, each with its own channel, so that I'm never late.

- Up to 5 reminders per event, each set as a time before the event (for example 2 h, 1 h, 30 min) and a channel (in-app/push, email or SMS).
- Org admins set default reminders per event type. Each user can change their own.
- SMS reminders use org credits (FND-13).
- **Students:** reminders for their classes and exams are on by default (push) and can be switched off per student.

**CAL-06 · Change notifications (Must)** As a student or teacher, I want to be told when a class is cancelled, moved or reassigned so that I don't turn up for nothing.

- Any change to an event in the next 48 hours notifies affected users at once by push. SMS is optional per org.

**CAL-07 · Calendar views and sync (Should)** As a user, I want day, week and month views, and to add my schedule to Google Calendar, so that I see everything in one place.

- Views: day, week and month, filtered by section, teacher or event type.
- A personal calendar subscription link (iCal) works with Google or Apple Calendar.

## Epic 10 — Plagiarism checker

**Goal:** show teachers how similar a submission is to classmates' work, and give an experimental hint about AI-written text. These are indicators for review, never proof.

**Built today:** nothing.

**Scope v1:** comparison against other students' submissions in the same org only. Internet comparison is a future add-on (paid service).

**PLG-01 · Similarity between classmates (Must)** As a teacher, I want each text submission compared with the other submissions for the same homework (and, optionally, earlier homework in the same subject) so that copying is visible.

- **What is checked:** typed answers, essay answers in exams, and text extracted from uploaded PDF and Word files.
- **Photos of handwriting:** checked only if handwriting recognition reads them; if not, they are marked "Not checked: handwritten image".
- **Result:** a similarity % per submission plus the most similar classmate(s), with matching passages highlighted side by side.
- Works for Bangla and English text.
- The check runs automatically after the due date (so everyone's work is in), or on demand.

**PLG-02 · Teacher review (Must)** As a teacher, I want to mark a flagged match as "Reviewed — OK" or "Copied" with a note so that my decision is recorded.

- Results are visible to teachers and admins only, never to students.
- A teacher's decision can feed into the homework score, but the system never changes a score on its own.

**PLG-03 · Thresholds (Should)** As an org admin, I want to set the similarity % that counts as "High" so that teachers see only meaningful alerts.

- Default: High at 40% and above, Medium at 20–39%.
- Short answers under 50 words are excluded from flags.

**PLG-04 · AI-writing indicator (Could, labelled Experimental)** As a teacher, I want an indicator of whether an English text may be AI-generated so that I know where to ask follow-up questions.

- Shown as Low, Medium or High likelihood with the label "Experimental — not reliable evidence".
- Bangla text is not scored until a reliable detector exists.
- Uses a third-party detection service, limited by plan because of cost.
- **Recommendation:** current AI detectors give many false results, especially for non-native writers. Don't sell this as a headline feature.

## Epic 11 — IELTS workspace

**Goal:** give IELTS centres and trainers their own workspace built around the four modules and band scores, instead of classes and GPA. Each centre can still add a course path based on its own course curriculum.

**Built today:** an IELTS exam category with Reading, Writing, Listening and Speaking module keys in the backend, and an IELTS option in the exam builder. There is no IELTS dashboard, no audio, no band conversion and no speaking flow.

**How it differs from Academic:**

- Courses and batches instead of classes and sections (fixed labels).
- Band scores (0–9 in half bands) instead of marks and GPA.
- The course path follows each centre's course curriculum. It reuses Epic 6 under that name, with an IELTS topic template as an optional starting point.
- Attendance, homework, resources, calendar, chat and plagiarism work exactly as in Academic.

**IEL-01 · IELTS sign-up and dashboard (Must)** As an IELTS centre owner, I want to choose "IELTS" at sign-up and land on an IELTS dashboard so that the product speaks my language.

- **Owner/teacher dashboard:** today's batches, upcoming mock tests, Writing and Speaking scripts waiting to be marked, and the average band per module per batch.
- **Student dashboard:** target band vs latest band per module, next mock test, and pending homework.

**IEL-02 · Student IELTS profile (Must)** As a teacher, I want each student's test type, target band and test date recorded so that coaching is focused.

- Fields:
  - test type: Academic or General Training
  - target overall band and target per module
  - booked test date (optional)
- A countdown to the test date is shown on the student dashboard.

**IEL-03 · Listening tests (Must)** As a teacher, I want to build Listening tests with audio and the standard question types so that students practise realistically.

- Audio upload per part (MP3), with an option to play only once like the real test. A transfer-time screen appears at the end.
- **Question types:** multiple choice, form/note/table/summary completion, matching, map/plan labelling, short answer.
- Answers are auto-scored, with an option to accept alternative spellings.
- The raw score out of 40 is converted to a band using an editable conversion table.

**IEL-04 · Reading tests (Must)** As a teacher, I want to build Reading tests with passages and the standard question types so that students practise realistically.

- Passages appear side by side with questions, with a 60-minute timer.
- **Question types:** True/False/Not Given, Yes/No/Not Given, matching headings, matching information, sentence and summary completion, multiple choice, short answer.
- Auto-scored. Raw score out of 40 → band, with separate conversion tables for Academic and General Training.

**IEL-05 · Writing tests and marking (Must)** As a teacher, I want to set Task 1 and Task 2 and mark them against the four official criteria so that students get a real band and useful feedback.

- Task 1 can include a chart or image (Academic) or a letter prompt (General Training).
- The student sees a live word count and a warning under 150 or 250 words.
- The teacher gives a band for each of Task Achievement/Response, Coherence & Cohesion, Lexical Resource and Grammatical Range & Accuracy, and can add comments on highlighted text.
- The Writing band is calculated with Task 2 counting double, rounded to the nearest half band.
- Plagiarism checks (Epic 10) run on Writing scripts.

**IEL-06 · Speaking practice and marking (Should)** As a student, I want to record answers to Speaking Part 1, 2 and 3 prompts in the app so that my teacher can mark them.

- **Part 2:** 1-minute preparation timer, then up to 2 minutes of recording.
- Recordings are compressed and stored (counts toward storage).
- The teacher listens and gives bands for Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy and Pronunciation, with optional voice or text feedback.
- **Alternative:** the teacher runs a live speaking session (in person or video call outside the app) and enters the bands.

**IEL-07 · Full mock tests (Must)** As a teacher, I want to combine Listening, Reading, Writing and Speaking into one mock test so that students get an overall band.

- Modules can run on the same day or on different days.
- **Overall band:** the average of the four module bands, rounded to the nearest half band (.25 rounds up to .5, .75 rounds up to the next whole band).
- Optional proctoring from Epic 5.

**IEL-08 · Band progress (Must)** As a student or teacher, I want a chart of bands per module over time against the target so that progress and gaps are obvious.

- The chart covers each mock and sectional test.
- The weakest question types are listed (for example "Matching headings: 45% correct").

**IEL-09 · Band report (Should)** As a teacher, I want a one-page band report per student per mock so that I can share it with the student or guardian.

- The report has the module bands, overall band, criteria bands for Writing and Speaking, teacher comments, and progress vs target.
- It is a PDF, optionally sent by SMS link (same rules as PRF-09).

## Feature-to-module map

Features are grouped into three sellable modules plus add-ons. Any account can buy Management only, Exams (with or without Proctoring), or both. Within a module, platform admins can still switch individual features on or off (FND-07).

| Epic | Module | Academic | IELTS | Solo teacher |
| --- | --- | --- | --- | --- |
| Foundations | Core (always on) | Yes | Yes (Course/Batch labels) | Yes (hidden branch, default session) |
| 1 · Attendance | Management | Yes | Yes | Class attendance only |
| 2 · Homework | Management | Yes | Yes | Yes |
| 3 · Performance & Reporting | Management (uses Exams results when Exams is on) | Yes | Replaced by IEL-08 and IEL-09 | Yes, without org dashboard |
| 4 · Question & homework authoring | Exams (question bank shared with Management homework) | Yes | Yes | Yes |
| 5 · AI-proctored exams | Exams + Proctoring add-on (Light or Strict) | Yes | Yes | Yes |
| 6 · Syllabus | Management | Yes | As an IELTS course plan | Yes, without admin oversight |
| 7 · Communication | Management | Yes | Yes | Yes |
| 8 · Resource hub | Management (video storage add-on) | Yes | Yes | Yes |
| 9 · Calendar & reminders | Management (exam dates also shown with Exams only) | Yes | Yes | Yes |
| 10 · Plagiarism checker | Add-on | Yes | Yes (Writing) | Yes |
| 11 · IELTS workspace | IELTS workspace type | No | Yes | Yes (IELTS trainer) |

**Usage-based add-ons:** SMS credit packs, extra storage, video storage, AI question drafting (QA-04), AI-writing indicator (PLG-04).

## Out of scope (future epics)

These came up while defining the features above and are deliberately left out of v1:

| Item | Why later |
| --- | --- |
| Fee collection and dues | Agreed as a future epic. It will reuse guardians, SMS credits and the academic structure. |
| Guardian login / parent app | v1 uses SMS and secure PDF links only. |
| Automatic face recognition for attendance | v1 photos are proof only (ATT-08); recognition needs accuracy testing and consent rules. |
| Internet plagiarism comparison | Needs a paid third-party service (PLG scope). |
| Live online classes (video) | Not requested; recorded classes are covered by Epic 8. |
| Data model and API notes | Requested later, once the stories are agreed. |
