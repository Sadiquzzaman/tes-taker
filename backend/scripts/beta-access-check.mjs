#!/usr/bin/env node
/**
 * Who can open what, on beta, for each kind of user (co-founder review, 13 Nov): every page while
 * signed out, the menu and every page for each role, and the API's answers per role for reads,
 * refused writes and other organisations. Uses the seeded Sunrise School accounts.
 *
 *   API_BASE=https://api-beta.instructor.academy/api/v1 WEB_BASE=https://beta.instructor.academy \
 *   TEST_PASSWORD=… node scripts/beta-access-check.mjs
 *
 * Reads only, plus writes that must be refused. Prints a table; never the password or tokens.
 */
const API = process.env.API_BASE;
const WEB = process.env.WEB_BASE;
const PASSWORD = process.env.TEST_PASSWORD;
if (!API || !WEB || !PASSWORD) {
  console.error('Set API_BASE, WEB_BASE and TEST_PASSWORD');
  process.exit(1);
}

const PUBLIC_PAGES = ['/', '/login', '/signup', '/signup/organization', '/forgot-password', '/join/class', '/join/test', '/auth/google/callback'];
const PAGES = [
  '/today', '/dashboard', '/account', '/classes', '/classes/create', '/sessions', '/tests', '/tests/create', '/grading', '/learning',
  '/calendar', '/routine', '/homework', '/homework-settings', '/my-attendance', '/leave',
  '/attendance', '/attendance-register', '/attendance-reports', '/attendance-settings', '/attendance-setup', '/attendance-branches', '/holidays',
  '/organization', '/organization/teachers', '/organization/assistants', '/organization/students', '/organization/classes',
  '/organization/assignments', '/organization/subjects', '/organization/setup',
  '/billing', '/features', '/activity-log', '/message-log', '/grading-scale',
  '/admin', '/admin/organizations', '/admin/users', '/admin/plans', '/admin/payments', '/admin/teachers', '/admin/teacher-requests',
  '/admin/feature-requests', '/admin/audit-log', '/admin/subjects', '/dev/ui', '/test/permissions',
];

const day = (n) => new Date(Date.now() + 6 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function api(method, path, token, body, orgId) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(orgId ? { 'X-Organization-Id': orgId } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

async function signIn(email, context) {
  const login = await api('POST', '/auth/login', null, { email, password: PASSWORD });
  if (login.status !== 200) throw new Error(`sign-in ${email} → ${login.status}`);
  let payload = login.body.payload;
  if (context) {
    const selected = await api('POST', '/auth/select-context', payload.access_token, context);
    if (selected.status !== 200) throw new Error(`select-context ${email} → ${selected.status}`);
    payload = selected.body.payload;
  }
  return payload;
}

/** The cookies the web app sets after sign-in (app/session/set-token). */
const cookiesOf = (p) =>
  [
    `token=${p.access_token}`,
    `role=${p.role}`,
    `session_mode=${p.session_mode === 'organization' ? 'organization' : 'individual'}`,
    `member_role=${p.organization?.role ?? ''}`,
    `organization_id=${p.organization?.id ?? ''}`,
    `personal_teacher=${p.personal_teacher_enabled ? '1' : ''}`,
  ].join('; ');

async function page(path, cookie) {
  const res = await fetch(`${WEB}${path}`, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
  const location = res.headers.get('location');
  return { status: res.status, to: location ? new URL(location, WEB).pathname : null, html: res.status === 200 ? await res.text() : '' };
}

/** The menu links in a server-rendered page (the sidebar). */
const menuOf = (html) => [...new Set([...html.matchAll(/<a[^>]+href="(\/[a-z0-9/-]*)"[^>]*aria-current|<a[^>]+href="(\/[a-z0-9/-]*)"/g)].map((m) => m[1] ?? m[2]))].filter((href) => PAGES.includes(href));

async function main() {
  const problems = [];
  const report = { signedOut: {}, pages: {}, menus: {}, api: [] };

  // 1. Signed out: every page but the public ones goes to the login page; the API answers 401.
  for (const path of [...PUBLIC_PAGES, ...PAGES]) {
    const res = await page(path);
    const outcome = res.status === 200 ? 'open' : res.to ? `→ ${res.to}` : String(res.status);
    report.signedOut[path] = outcome;
    const isPublic = PUBLIC_PAGES.includes(path);
    if (!isPublic && !(res.to === '/login')) problems.push(`signed out: ${path} is ${outcome}, expected → /login`);
    if (isPublic && res.status !== 200 && res.to !== '/login') problems.push(`signed out: public ${path} is ${outcome}`);
  }
  for (const path of ['/routine', `/calendar/me?from=${day(0)}&to=${day(7)}`, '/organizations/admin', '/homework', '/attendance/setup']) {
    const res = await api('GET', path);
    if (res.status !== 401) problems.push(`signed out: API GET ${path} → ${res.status}, expected 401`);
  }

  // 2. The people.
  const plain = await signIn('sun.owner@yopmail.com');
  const contexts = (await api('GET', '/auth/contexts', plain.access_token)).body.payload;
  const sunrise = contexts.find((c) => c.label === 'Sunrise School').organization_id;
  const demoPlain = await signIn('demo.owner@yopmail.com');
  const demo = (await api('GET', '/auth/contexts', demoPlain.access_token)).body.payload.find((c) => c.label === 'Demo School').organization_id;
  const school = { type: 'organization', organization_id: sunrise };
  const solo = await signIn('sun.solo@yopmail.com');
  const people = {
    platform: await signIn('test.platform@yopmail.com'),
    owner: await signIn('sun.owner@yopmail.com', school),
    admin: await signIn('sun.admin@yopmail.com', school),
    staff: await signIn('sun.staff1@yopmail.com', school),
    teacher: await signIn('sun.teacher1@yopmail.com', school),
    student: await signIn('sun.student07@yopmail.com', school),
    solo: await signIn('sun.solo@yopmail.com', { type: 'personal_teacher' }),
    soloStudent: await signIn('sun.student03@yopmail.com', { type: 'individual_teacher', teacher_id: solo.id }),
  };

  // 3. Pages and menus per role (what the server lets through; pages may still show a "not for you" message).
  for (const [who, p] of Object.entries(people)) {
    const cookie = cookiesOf(p);
    report.pages[who] = {};
    for (const path of PAGES) {
      const res = await page(path, cookie);
      report.pages[who][path] = res.status === 200 ? 'open' : res.to ? `→ ${res.to}` : String(res.status);
      if (path === '/today' || (who === 'platform' && path === '/admin')) report.menus[who] = menuOf(res.html);
    }
    for (const href of report.menus[who] ?? []) {
      if (report.pages[who][href] !== 'open') problems.push(`${who}: menu links ${href}, which is ${report.pages[who][href]}`);
    }
  }

  // 4. The API per role: who may read, which writes are refused, and other organisations.
  const roles = ['owner', 'admin', 'staff', 'teacher', 'student'];
  const reads = [
    ['GET', `/organizations/${sunrise}/members`, ['owner', 'admin', 'staff']],
    ['GET', `/organizations/${sunrise}/members/lookup?q=sun.student01@yopmail.com`, ['owner', 'admin']],
    ['GET', '/setup', ['owner', 'admin']],
    ['GET', '/attendance/setup', ['owner', 'admin', 'staff', 'teacher']],
    ['GET', '/homework', ['owner', 'admin', 'staff', 'teacher']],
    ['GET', '/routine', roles],
    ['GET', `/calendar/me?from=${day(0)}&to=${day(7)}`, roles],
    // Staff pages read the organisation settings; students have no page that does.
    ['GET', `/organizations/${sunrise}/settings`, ['owner', 'admin', 'staff', 'teacher']],
    ['GET', '/audit-logs', ['owner', 'admin']],
    ['GET', `/attendance/reports/teachers?from=${day(-7)}&to=${day(0)}`, ['owner', 'admin']],
    ['GET', `/events?from=${day(0)}&to=${day(30)}`, roles],
  ];
  const refusedWrites = [
    ['POST', '/holidays', { date_from: day(40), name: 'Not allowed' }, ['staff', 'teacher', 'student']],
    ['POST', '/events', { type: 'OTHER', title: 'Not allowed', description: null, starts_at: `${day(41)}T04:00:00.000Z`, ends_at: `${day(41)}T05:00:00.000Z`, place: null, whole_org: true, section_ids: [], user_ids: [] }, ['student']],
    ['POST', `/organizations/${sunrise}/members`, { query: 'sun.student60@yopmail.com', role: 'STUDENT' }, ['staff', 'teacher', 'student']],
    ['PATCH', `/organizations/${sunrise}/settings`, { class_teacher_enabled: true }, ['staff', 'teacher', 'student']],
    ['POST', '/routine/slots', { section_id: '00000000-0000-4000-8000-000000000000', day_of_week: 6, start_time: '07:00', end_time: '07:30' }, ['student']],
  ];
  const check = async (who, method, path, body, orgId) => (await api(method, path, people[who].access_token, body, orgId)).status;
  for (const [method, path, allowed] of reads) {
    for (const who of roles) {
      const status = await check(who, method, path);
      const ok = status >= 200 && status < 300;
      report.api.push(`${who.padEnd(8)} ${method} ${path} → ${status}`);
      if (ok !== allowed.includes(who)) problems.push(`API ${who} ${method} ${path} → ${status}, expected ${allowed.includes(who) ? '2xx' : 'refused'}`);
    }
  }
  for (const [method, path, body, refused] of refusedWrites) {
    for (const who of refused) {
      const status = await check(who, method, path, body);
      report.api.push(`${who.padEnd(8)} ${method} ${path} → ${status}`);
      if (status !== 403 && status !== 404) problems.push(`API ${who} ${method} ${path} → ${status}, expected 403/404`);
    }
  }
  // Another organisation, by path and by header; and the platform's admin pages.
  for (const who of roles) {
    const byPath = await check(who, 'GET', `/organizations/${demo}/members`);
    const byHeader = await check(who, 'GET', '/routine', undefined, demo);
    report.api.push(`${who.padEnd(8)} Demo School members → ${byPath}, Demo School routine by header → ${byHeader}`);
    if (byPath < 400) problems.push(`API ${who} reads Demo School's members (${byPath})`);
    if (byHeader < 400) problems.push(`API ${who} reads Demo School's routine with its header (${byHeader})`);
  }
  for (const who of [...roles, 'platform']) {
    const status = await check(who, 'GET', '/organizations/admin');
    report.api.push(`${who.padEnd(8)} GET /organizations/admin → ${status}`);
    if ((status === 200) !== (who === 'platform')) problems.push(`API ${who} GET /organizations/admin → ${status}`);
  }

  console.log(JSON.stringify({ report, problems }, null, 1));
}

main().catch((error) => {
  console.error(`Stopped: ${error.message}`);
  process.exit(1);
});
