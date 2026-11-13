#!/usr/bin/env node
/**
 * Fills the seeded "Sunrise School" (test seed) with a school's worth of data through the API, so
 * everything goes through the app's own rules: five classes with two sections (morning and day
 * shift), six subjects with their teachers, sixty students, a full weekly routine, the school's
 * pin and one online section, holidays, events, homework and leave for the next three months,
 * a few exams, results (terms, paper exams with marks, behaviour ratings, score weights and report
 * cards; P7), and links to the Demo School and a solo teacher (people in more than one workspace).
 *
 *   API_BASE=https://api-beta.instructor.academy/api/v1 TEST_PASSWORD=… node scripts/beta-sunrise-data.mjs
 *
 * Safe to run again: each step looks first and only adds what is missing. Prints counts, never
 * the password or tokens.
 */
import { randomUUID } from 'node:crypto';

const API = process.env.API_BASE;
const PASSWORD = process.env.TEST_PASSWORD;
if (!API || !PASSWORD) {
  console.error('Set API_BASE and TEST_PASSWORD');
  process.exit(1);
}

const DAY = 86_400_000;
const SCHOOL = 'Sunrise School';
const WEEK = [6, 7, 1, 2, 3, 4]; // Saturday to Thursday (Friday is the weekly off day)
const SUBJECTS = [
  ['Bangla', 'BAN'],
  ['English', 'ENG'],
  ['Mathematics', 'MATH'],
  ['Science', 'SCI'],
  ['Bangladesh and Global Studies', 'BGS'],
  ['ICT', 'ICT'],
];
const CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const MORNING = [['08:00', '08:45'], ['08:50', '09:35'], ['09:40', '10:25'], ['10:45', '11:30'], ['11:35', '12:20']];
const DAYTIME = [['12:40', '13:25'], ['13:30', '14:15'], ['14:20', '15:05'], ['15:20', '16:05'], ['16:10', '16:55']];

const count = {};
const tally = (key, n = 1) => (count[key] = (count[key] ?? 0) + n);

async function call(method, path, token, body, orgId) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(orgId ? { 'X-Organization-Id': orgId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

/** Fails loudly with the route and the API's code, never the token. */
async function must(method, path, token, body, orgId, ok = [200, 201]) {
  const res = await call(method, path, token, body, orgId);
  if (!ok.includes(res.status)) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(res.body?.code ?? res.body?.message ?? '').slice(0, 200)}`);
  }
  return res.body?.payload ?? res.body;
}

async function signIn(email) {
  const payload = await must('POST', '/auth/login', null, { email, password: PASSWORD });
  return { token: payload.access_token, user: payload };
}

/** Signs in and opens the organisation workspace (a token locked to it). */
async function inSchool(email, organizationId) {
  const { token } = await signIn(email);
  const payload = await must('POST', '/auth/select-context', token, { type: 'organization', organization_id: organizationId });
  return { token: payload.access_token, org: organizationId, id: payload.id };
}

const iso = (date) => date.toISOString().slice(0, 10);
const dhakaToday = () => iso(new Date(Date.now() + 6 * 3_600_000));
const addDays = (date, n) => iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY));
/** A Dhaka wall time as an ISO instant. */
const at = (date, time) => new Date(`${date}T${time}:00+06:00`).toISOString();
const doc = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

async function main() {
  const today = dhakaToday();

  // The owner and the school.
  const { token: plainOwner } = await signIn('sun.owner@yopmail.com');
  const contexts = await must('GET', '/auth/contexts', plainOwner);
  const school = contexts.find((c) => c.type === 'organization' && c.label === SCHOOL);
  if (!school) throw new Error('Sunrise School not found: run the test seed first');
  const orgId = school.organization_id;
  const owner = await inSchool('sun.owner@yopmail.com', orgId);
  const get = (who, path) => must('GET', path, who.token, undefined, who.org);
  const post = (who, path, body) => must('POST', path, who.token, body, who.org);

  await get(owner, '/setup'); // makes the default session
  const members = await get(owner, `/organizations/${orgId}/members`);
  const teacherIds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => members.find((m) => m.user.email === `sun.teacher${n}@yopmail.com`)?.user.id);
  if (teacherIds.some((id) => !id)) throw new Error('Sunrise teachers missing: run the test seed first');

  // Subjects.
  let subjects = await get(owner, `/organizations/${orgId}/subjects`);
  for (const [name, code] of SUBJECTS) {
    if (subjects.some((s) => s.name === name)) continue;
    await post(owner, `/organizations/${orgId}/subjects`, { name, code });
    tally('subjects');
  }
  subjects = await get(owner, `/organizations/${orgId}/subjects`);
  const subjectId = (name) => subjects.find((s) => s.name === name).id;

  // Classes, sections A (morning) and B (day), subjects on each class.
  let classes = await get(owner, '/classes');
  for (const name of CLASSES) {
    if (classes.some((c) => c.class_name === name)) continue;
    await post(owner, '/classes', { class_name: name });
    tally('classes');
  }
  classes = await get(owner, '/classes');
  const sections = [];
  for (const [ci, name] of CLASSES.entries()) {
    const klass = classes.find((c) => c.class_name === name);
    let own = await get(owner, `/classes/${klass.id}/sections`);
    if (!own.some((s) => s.name === 'B')) {
      await post(owner, `/classes/${klass.id}/sections`, { name: 'B' });
      tally('sections');
      own = await get(owner, `/classes/${klass.id}/sections`);
    }
    const attached = await get(owner, `/classes/${klass.id}/subjects`);
    for (const [subject] of SUBJECTS) {
      if (attached.some((a) => a.subject_id === subjectId(subject))) continue;
      await post(owner, `/classes/${klass.id}/subjects`, { subject_id: subjectId(subject) });
      tally('class subjects');
    }
    for (const section of own.filter((s) => s.name === 'A' || s.name === 'B')) {
      const shift = section.name === 'A' ? 'MORNING' : 'DAY';
      const room = `Room ${ci + 6}${section.name}`;
      if (section.room !== room) {
        await must('PATCH', `/sections/${section.id}`, owner.token, { room, shift }, orgId);
        tally('section rooms');
      }
      sections.push({ ...section, classIndex: ci, classId: klass.id, className: name, room, shift });
    }
  }

  // Subject teachers: one per subject in each shift, so no teacher is in two places at once.
  const teacherFor = (shift, subjectIndex) => teacherIds[shift === 'MORNING' ? subjectIndex : (subjectIndex + 2) % 8];
  for (const section of sections) {
    section.offerings = await get(owner, `/sections/${section.id}/offerings`);
    for (const [si, [subject]] of SUBJECTS.entries()) {
      const offering = section.offerings.find((o) => o.subject.name === subject);
      const teacher = teacherFor(section.shift, si);
      if (offering.teachers.some((p) => p.id === teacher)) continue;
      await must('PUT', `/offerings/${offering.id}/teachers`, owner.token, { teacher_ids: [teacher] }, orgId);
      tally('subject teachers');
    }
    section.offerings = await get(owner, `/sections/${section.id}/offerings`);
  }

  // Students: six per section.
  for (const [i, section] of sections.entries()) {
    const enrolled = await get(owner, `/sections/${section.id}/enrolments`);
    for (let k = 0; k < 6; k += 1) {
      const email = `sun.student${String(i * 6 + k + 1).padStart(2, '0')}@yopmail.com`;
      if (enrolled.some((e) => e.student?.email === email)) continue;
      await post(owner, `/sections/${section.id}/enrolments`, { email, roll_no: String(k + 1) });
      tally('enrolments');
    }
  }

  // The weekly routine: five periods a day, Saturday to Thursday; the subject rotates by day.
  const routine = await get(owner, '/routine');
  for (const section of sections) {
    const periods = section.shift === 'MORNING' ? MORNING : DAYTIME;
    for (const [di, day] of WEEK.entries()) {
      for (const [pi, [start, end]] of periods.entries()) {
        if (routine.slots.some((s) => s.section.id === section.id && s.day_of_week === day && s.start_time === start)) continue;
        const si = (section.classIndex + pi + di) % SUBJECTS.length;
        const offering = section.offerings.find((o) => o.subject.name === SUBJECTS[si][0]);
        await post(owner, '/routine/slots', {
          section_id: section.id,
          offering_id: offering.id,
          teacher_id: teacherFor(section.shift, si),
          room: section.room,
          day_of_week: day,
          start_time: start,
          end_time: end,
        });
        tally('routine periods');
      }
    }
  }

  // The school's pin (in-person check-in) and one online section (check in from anywhere).
  const branches = await get(owner, '/attendance/branches');
  const main = branches.find((b) => b.is_default) ?? branches[0];
  if (main && main.geo_lat === null) {
    await must('PATCH', `/attendance/branches/${main.id}`, owner.token, { geo_lat: 23.7808, geo_lng: 90.4074, checkin_radius_m: 200 }, orgId);
    tally('pin');
  }
  const online = sections.find((s) => s.className === 'Class 10' && s.name === 'B');
  await must('PATCH', `/attendance/setup/sections/${online.id}`, owner.token, { class_type: 'ONLINE' }, orgId);

  // Holidays in the next three months.
  const known = (await get(owner, `/holidays?from=${today}&to=${addDays(today, 120)}`)).map((h) => h.date_from);
  for (const [from, to, name] of [
    ['2026-12-16', null, 'Victory Day'],
    ['2026-12-25', null, 'Christmas Day'],
    ['2026-12-26', '2026-12-31', 'Winter break'],
    ['2027-02-21', null, 'International Mother Language Day'],
  ]) {
    if (from <= today || known.includes(from)) continue;
    await post(owner, '/holidays', { date_from: from, ...(to ? { date_to: to } : {}), name });
    tally('holidays');
  }

  // Events over the next three months.
  const events = await get(owner, `/events?from=${today}&to=${addDays(today, 60)}`);
  const later = await get(owner, `/events?from=${addDays(today, 61)}&to=${addDays(today, 100)}`);
  const titles = new Set([...events, ...later].map((e) => e.title));
  const classSections = (name) => sections.filter((s) => s.className === name).map((s) => s.id);
  const plan = [
    [3, '15:00', '16:00', 'MEETING', 'Teachers meeting', 'Staff room', { user_ids: teacherIds }],
    [6, '10:00', '12:00', 'PARENT_MEETING', 'Class 6 parent meeting', 'Hall', { section_ids: classSections('Class 6') }],
    [9, '09:00', '13:00', 'ACTIVITY', 'Science fair', 'Playground', { whole_org: true }],
    [16, '10:00', '11:30', 'PARENT_MEETING', 'Class 10 parent meeting', 'Hall', { section_ids: classSections('Class 10') }],
    [22, '08:30', '12:30', 'EXAM', 'Half-yearly exam starts', 'Classrooms', { whole_org: true }],
    [40, '15:00', '16:00', 'MEETING', 'Results review', 'Staff room', { user_ids: teacherIds }],
    [55, '09:00', '14:00', 'ACTIVITY', 'Annual sports day', 'Field', { whole_org: true }],
    [70, '10:00', '12:00', 'OTHER', 'Cultural programme rehearsal', 'Hall', { section_ids: classSections('Class 8') }],
    [85, '10:00', '11:00', 'PARENT_MEETING', 'Class 9 parent meeting', 'Hall', { section_ids: classSections('Class 9') }],
  ];
  for (const [offset, start, end, type, title, place, who] of plan) {
    if (titles.has(title)) continue;
    let date = addDays(today, offset);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 5) date = addDays(date, 1); // not on Friday
    await post(owner, '/events', {
      type,
      title,
      description: null,
      starts_at: at(date, start),
      ends_at: at(date, end),
      place,
      whole_org: false,
      section_ids: [],
      user_ids: [],
      ...who,
    });
    tally('events');
  }

  // Homework from each teacher, due over the coming weeks.
  for (const [ti, email] of [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n - 1, `sun.teacher${n}@yopmail.com`])) {
    const teacher = await inSchool(email, orgId);
    const mine = await get(teacher, '/homework');
    const taught = await get(teacher, '/homework/subject-classes');
    for (const [hi, sc] of taught.slice(0, 3).entries()) {
      const title = `${sc.subject.name}: chapter ${hi + 3} exercise (${sc.section_label})`;
      if (mine.some((h) => h.title === title)) continue;
      const due = new Date(at(addDays(today, 3 + ti * 4 + hi * 9), '22:00'));
      const created = await post(teacher, '/homework', {
        title,
        instructions: doc(`Do the exercises at the end of chapter ${hi + 3}. Show your working.`),
        submission_type: hi % 2 ? 'TEXT' : 'FILE',
        total_marks: 10,
        due_at: due.toISOString(),
        offering_ids: [sc.offering_id],
      });
      await post(teacher, `/homework/${created.id}/publish`, {});
      tally('homework');
    }
  }

  // Exams: one per class, a week or more ahead, made by the subject's teacher for their section A
  // (only a class's own teachers make its exams).
  for (const [ci, name] of CLASSES.entries()) {
    const klass = classes.find((c) => c.class_name === name);
    const si = ci % SUBJECTS.length;
    const subject = SUBJECTS[si][0];
    const sectionA = sections.find((s) => s.className === name && s.name === 'A');
    const offering = sectionA.offerings.find((o) => o.subject.name === subject);
    const teacherEmail = `sun.teacher${teacherIds.indexOf(teacherFor('MORNING', si)) + 1}@yopmail.com`;
    const teacher = await inSchool(teacherEmail, orgId);
    const testName = `${name} A ${subject} class test`;
    const existing = await call('GET', '/exams', teacher.token, undefined, orgId);
    const list = existing.body?.payload?.items ?? existing.body?.payload ?? [];
    if (Array.isArray(list) && list.some((e) => (e.test_name ?? e.testName) === testName)) continue;
    const start = at(addDays(today, 8 + ci * 7), '10:00');
    const correct = randomUUID();
    const res = await call(
      'POST',
      '/exams',
      teacher.token,
      {
        formState: { testName, duration: '40', passingScore: '', allowNegativeMarking: false, negativeMarking: '', isModelTest: false },
        subjects: [
          {
            id: subjectId(subject),
            questions: [
              {
                id: randomUUID(),
                type: 'graded',
                subType: 'multiple-choice',
                text: 'Which one is correct?',
                instruction: '',
                image: null,
                answer: { type: 'optionId', value: [correct] },
                options: [
                  { id: correct, text: 'This one', image: null },
                  { id: randomUUID(), text: 'Not this', image: null },
                  { id: randomUUID(), text: 'Nor this', image: null },
                ],
                points: 1,
                showValidation: false,
              },
            ],
          },
        ],
        publishState: {
          publishTiming: 'later',
          scheduleAt: start,
          endingAt: new Date(new Date(start).getTime() + 2 * 3_600_000).toISOString(),
          testAudience: 'selected_class',
          selectedClassId: klass.id,
          selectedOfferingId: offering.id,
          excluded_students: [],
        },
      },
      orgId,
    );
    if (res.status === 201 || res.status === 200) tally('exams');
    else tally(`exams refused (${res.status} ${String(res.body?.message ?? '').slice(0, 60)})`);
  }

  // Leave: two students apply ahead, one is approved by the admin.
  const admin = await inSchool('sun.admin@yopmail.com', orgId);
  for (const [n, from, days, approve] of [
    ['01', addDays(today, 5), 1, true],
    ['13', addDays(today, 12), 2, false],
  ]) {
    const student = await inSchool(`sun.student${n}@yopmail.com`, orgId);
    const mine = await get(student, '/attendance/leave/mine');
    if ((mine.requests ?? mine).length) continue;
    const leave = await post(student, '/attendance/leave', { from_date: from, to_date: addDays(from, days - 1), reason: 'Family programme in the village.' });
    tally('leave requests');
    if (approve) {
      await post(admin, `/attendance/leave/${leave.id}/approve`, {});
      tally('leave approved');
    }
  }

  // Results (P7): two terms; per section a half-yearly paper exam in Bangla and Mathematics
  // (MCQ 30 + Written 70, published) and a monthly Mathematics test (out of 20, one absent, not
  // published); behaviour in Mathematics on three days; weights for Classes 9 and 10; positions
  // shown to students; report cards for Class 6 A. Cards are made, not sent: sending texts
  // guardians on the school's SMS credits. Marks are made up but steady from run to run.
  const session = (await get(owner, '/sessions')).find((s) => s.is_default) ?? (await get(owner, '/sessions'))[0];
  const year = session.start_date.slice(0, 4);
  let terms = await get(owner, `/sessions/${session.id}/terms`);
  for (const [name, start, end] of [
    ['Half-yearly', session.start_date, `${year}-06-30`],
    ['Annual', `${year}-07-01`, session.end_date],
  ]) {
    if (terms.some((t) => t.name === name)) continue;
    await post(owner, `/sessions/${session.id}/terms`, { name, start_date: start, end_date: end });
    tally('terms');
  }
  terms = await get(owner, `/sessions/${session.id}/terms`);
  const halfYearly = terms.find((t) => t.name === 'Half-yearly');
  const paperExams = await get(owner, '/offline-exams');
  const markFor = (seed, out) => Math.round(((35 + ((seed * 37) % 61)) / 100) * out * 2) / 2;
  for (const [i, section] of sections.entries()) {
    for (const [subject, name, date, total, parts, termId, publish] of [
      ['Bangla', 'Half-yearly Bangla', `${year}-06-15`, 100, true, halfYearly.id, true],
      ['Mathematics', 'Half-yearly Mathematics', `${year}-06-17`, 100, true, halfYearly.id, true],
      ['Mathematics', 'Monthly test Mathematics', addDays(today, -10), 20, false, null, false],
    ]) {
      const offering = section.offerings.find((o) => o.subject.name === subject);
      let exam = paperExams.find((e) => e.offering.id === offering.id && e.name === name);
      if (!exam) {
        exam = await post(owner, '/offline-exams', {
          offering_id: offering.id,
          name,
          exam_date: date,
          total_marks: total,
          parts: parts ? [{ name: 'MCQ', marks: 30 }, { name: 'Written', marks: 70 }] : null,
          term_id: termId,
        });
        tally('paper exams');
      }
      const grid = await get(owner, `/offline-exams/${exam.id}/marks`);
      const rows = grid.rows
        .filter((row) => row.marks === null && !row.is_absent)
        .map((row, k) => {
          const seed = i * 7 + k * 3 + subject.length + total;
          if (!parts && Number(row.student.roll_no) === 6) return { student_id: row.student.id, is_absent: true };
          return parts
            ? { student_id: row.student.id, part_marks: { MCQ: markFor(seed, 30), Written: markFor(seed + 5, 70) }, is_absent: false }
            : { student_id: row.student.id, marks: markFor(seed, total), is_absent: false };
        });
      if (rows.length) {
        await must('PUT', `/offline-exams/${exam.id}/marks`, owner.token, { rows }, orgId);
        tally('paper exam marks', rows.length);
      }
      if (publish && !exam.published_at) {
        await post(owner, `/offline-exams/${exam.id}/publish`, {});
        tally('paper exams published');
      }
    }
    // Behaviour in Mathematics, three days back.
    const maths = section.offerings.find((o) => o.subject.name === 'Mathematics');
    for (const back of [2, 9, 16]) {
      const day = addDays(today, -back);
      const grid = await get(owner, `/behaviour/grid?offering_id=${maths.id}&date=${day}`);
      const rows = grid.rows
        .filter((row) => Object.keys(row.ratings).length === 0)
        .map((row, k) => ({
          student_id: row.student.id,
          ratings: Object.fromEntries(grid.criteria.map((c, ci) => [c.id, 2 + ((i + k + ci + back) % 4)])),
          remark: k === 0 && back === 2 ? 'Helps others in group work.' : undefined,
        }));
      if (rows.length) {
        await must('PUT', '/behaviour/grid', owner.token, { offering_id: maths.id, date: day, rows }, orgId);
        tally('behaviour ratings', rows.length);
      }
    }
  }
  const weights = await get(owner, `/scores/weights?session_id=${session.id}`);
  for (const row of weights.classes.filter((c) => ['Class 9', 'Class 10'].includes(c.class.name) && c.is_default)) {
    await must('PUT', '/scores/weights', owner.token, { session_id: session.id, class_id: row.class.id, exams_pct: 60, homework_pct: 15, attendance_pct: 15, behaviour_pct: 10 }, orgId);
    tally('score weights');
  }
  if (!(await get(owner, '/scores/settings')).show_rank) {
    await must('PUT', '/scores/settings', owner.token, { show_rank: true }, orgId);
    tally('show positions');
  }
  const class6A = sections.find((s) => s.className === 'Class 6' && s.name === 'A');
  const cards = await get(owner, `/report-cards?section_id=${class6A.id}&term_id=${halfYearly.id}`);
  if (cards.rows.some((r) => !r.latest)) {
    await post(owner, '/report-cards/generate', {
      section_id: class6A.id,
      term_id: halfYearly.id,
      locale: 'bn',
      rows: cards.rows.map((r, k) => ({
        student_id: r.student.id,
        teacher_remark: k % 2 ? 'নিয়মিত অনুশীলন করলে আরও ভালো করবে।' : 'মনোযোগী ও পরিশ্রমী।',
        principal_remark: 'শুভকামনা রইল।',
      })),
    });
    tally('report cards');
  }

  // People in more than one workspace: a Sunrise teacher also teaches at Demo School, and a
  // Sunrise student also studies there; a few Sunrise students join the solo teacher's class.
  const { token: plainDemo } = await signIn('demo.owner@yopmail.com');
  const demoContext = (await must('GET', '/auth/contexts', plainDemo)).find((c) => c.label === 'Demo School');
  if (demoContext) {
    const demo = await inSchool('demo.owner@yopmail.com', demoContext.organization_id);
    const demoMembers = await get(demo, `/organizations/${demo.org}/members`);
    if (!demoMembers.some((m) => m.user.email === 'sun.teacher1@yopmail.com')) {
      await post(demo, `/organizations/${demo.org}/members`, { query: 'sun.teacher1@yopmail.com', role: 'TEACHER' });
      tally('demo school teacher');
    }
    const demoClasses = await get(demo, '/classes');
    const class6 = demoClasses.find((c) => c.class_name === 'Class 6');
    if (class6) {
      const [sectionA] = (await get(demo, `/classes/${class6.id}/sections`)).filter((s) => s.name === 'A');
      const enrolled = await get(demo, `/sections/${sectionA.id}/enrolments`);
      if (!enrolled.some((e) => e.student?.email === 'sun.student02@yopmail.com')) {
        await post(demo, `/sections/${sectionA.id}/enrolments`, { email: 'sun.student02@yopmail.com' });
        tally('demo school student');
      }
    }
  }
  const { token: soloToken } = await signIn('sun.solo@yopmail.com');
  const soloWorkspace = await must('POST', '/auth/select-context', soloToken, { type: 'personal_teacher' });
  const solo = { token: soloWorkspace.access_token };
  const soloClasses = await must('GET', '/classes', solo.token);
  const soloList = Array.isArray(soloClasses) ? soloClasses : (soloClasses?.items ?? soloClasses?.data ?? []);
  if (!soloList.some((c) => c.class_name === 'Evening Maths Batch')) {
    const created = await must('POST', '/classes', solo.token, { class_name: 'Evening Maths Batch' });
    await must('POST', `/classes/${created.id}/students`, solo.token, { students: ['sun.student03@yopmail.com', 'sun.student04@yopmail.com', 'sun.student05@yopmail.com'] });
    tally('solo class');
  }

  console.log(JSON.stringify({ school: SCHOOL, sections: sections.length, added: count }, null, 1));
}

main().catch((error) => {
  console.error(`Stopped: ${error.message}`);
  process.exit(1);
});
