#!/usr/bin/env node
/**
 * Fills the seeded IELTS centre "Bright Path IELTS" (test seed) with an IELTS centre's worth of
 * data through the API, so everything goes through the app's own rules: two courses with a batch
 * each, student profiles, a full Academic mock (Listening recordings and a Writing chart are
 * generated here), practice sets, a draft, openings for the batches, students taking the tests,
 * Writing and Speaking marked (some left waiting), a live Speaking session and practice
 * recordings, and a plagiarism check on Writing. All texts are written for this script; no
 * official IELTS material.
 *
 *   API_BASE=https://api-beta.instructor.academy/api/v1 TEST_PASSWORD=… node scripts/beta-ielts-data.mjs
 *
 * Safe to run again: each step looks first and only adds what is missing. Prints counts, never
 * the password or tokens.
 */
import { deflateSync } from 'node:zlib';

const API = process.env.API_BASE;
const PASSWORD = process.env.TEST_PASSWORD;
if (!API || !PASSWORD) {
  console.error('Set API_BASE and TEST_PASSWORD');
  process.exit(1);
}

const CENTRE = 'Bright Path IELTS';
const DAY = 86_400_000;
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
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(res.body?.code ?? res.body?.message ?? '').slice(0, 300)}`);
  }
  return res.body?.payload ?? res.body;
}

async function signIn(email) {
  const payload = await must('POST', '/auth/login', null, { email, password: PASSWORD });
  return { token: payload.access_token };
}

/** Signs in and opens the centre's workspace (a token locked to it). */
async function inCentre(email, organizationId) {
  const { token } = await signIn(email);
  const payload = await must('POST', '/auth/select-context', token, { type: 'organization', organization_id: organizationId });
  return { token: payload.access_token, org: organizationId, id: payload.id, email };
}

const api = (who) => ({
  get: (path) => must('GET', path, who.token, undefined, who.org),
  post: (path, body) => must('POST', path, who.token, body ?? {}, who.org),
  put: (path, body) => must('PUT', path, who.token, body, who.org),
  patch: (path, body) => must('PATCH', path, who.token, body, who.org),
  raw: (method, path, body) => call(method, path, who.token, body, who.org),
});

// ------------------------------------------------------------------ generated files

/** A few seconds of a soft tone as a WAV (8 kHz, mono): stands in for a Listening recording. */
function wav(seconds, hz) {
  const rate = 8000;
  const samples = rate * seconds;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i += 1) {
    const fade = Math.min(1, i / 800, (samples - i) / 800);
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 6000 * fade), 44 + i * 2);
  }
  return buf;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** A simple bar chart as a PNG (white background, grey axes, blue bars): the Writing Task 1 picture. */
function barChart(values) {
  const [w, h] = [480, 300];
  const px = Buffer.alloc(w * h * 3, 255);
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 3;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  };
  for (let x = 40; x < w - 20; x += 1) set(x, h - 30, [120, 120, 120]);
  for (let y = 20; y < h - 30; y += 1) set(40, y, [120, 120, 120]);
  for (let line = 1; line <= 4; line += 1) for (let x = 41; x < w - 20; x += 3) set(x, h - 30 - line * 55, [220, 220, 220]);
  const max = Math.max(...values);
  values.forEach((v, i) => {
    const barH = Math.round((v / max) * 220);
    const x0 = 60 + i * 70;
    for (let x = x0; x < x0 + 44; x += 1) for (let y = h - 31; y > h - 31 - barH; y -= 1) set(x, y, i % 2 ? [37, 99, 235] : [14, 116, 144]);
  });
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Uploads a file for IELTS the way the web does: signed link, PUT, complete. */
async function upload(who, name, mime, data) {
  const p = await api(who).post('/files/presign', { purpose: 'IELTS', mime, size: data.length, name });
  const headers = { ...(p.upload.headers ?? {}) };
  // A local-storage stand-in for S3 is on the API itself and needs the caller.
  if (p.upload.url.startsWith(API.replace(/\/api\/v1$/, ''))) Object.assign(headers, { Authorization: `Bearer ${who.token}`, 'X-Organization-Id': who.org });
  const res = await fetch(p.upload.url, { method: p.upload.method ?? 'PUT', headers, body: data });
  if (!res.ok) throw new Error(`upload ${name} → ${res.status}`);
  await api(who).post(`/files/${p.file.id}/complete`);
  tally('files uploaded');
  return p.file.id;
}

// ------------------------------------------------------------------ the paper

const opts = (...texts) => texts.map((text, i) => ({ key: String.fromCharCode(65 + i), text }));
const sa = (prompt, accepted) => ({ prompt, answer: { accepted } });
const ch = (prompt, key, options) => ({ prompt, ...(options ? { options } : {}), answer: { keys: Array.isArray(key) ? key : [key] } });

const LISTENING = [
  {
    title: 'Booking a community hall',
    content: '<p>A caller books the riverside community hall for a weekend workshop.</p>',
    groups: [
      {
        type: 'NOTE_COMPLETION',
        instruction: 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
        word_limit: 1,
        shared: {
          text: 'Hall booking\nName of group: the [[1]] Club\nDate: Saturday [[2]] March\nNumber of people: about [[3]]\nRoom needed: the [[4]] room\nEquipment: a [[5]] and two microphones\nDrinks: [[6]] and water only\nParking: behind the [[7]]\nDeposit: £[[8]]\nPay by: [[9]]\nContact: Ms [[10]]',
        },
        questions: [['Photography'], ['14', 'fourteen'], ['40', 'forty'], ['garden'], ['projector'], ['tea'], ['library'], ['75'], ['card'], ['Hartley']].map((accepted) => ({ answer: { accepted } })),
      },
    ],
  },
  {
    title: 'A guided walk in the hills',
    content: '<p>A guide explains a day walk to a group of visitors.</p>',
    groups: [
      {
        type: 'MCQ_SINGLE',
        instruction: 'Choose the correct letter, A, B or C.',
        questions: [
          ch('The walk starts at', 'B', opts('the car park', 'the old bridge', 'the visitor centre')),
          ch('Walkers should bring', 'A', opts('a waterproof jacket', 'a map', 'a torch')),
          ch('Lunch will be eaten', 'C', opts('at the farm', 'on the bus', 'beside the lake')),
          ch('The steepest section is', 'A', opts('after lunch', 'at the start', 'near the end')),
          ch('The guide recommends', 'B', opts('walking poles', 'good boots', 'sun cream')),
          ch('The walk ends at', 'C', opts('the church', 'the station', 'the tea rooms')),
        ],
      },
      {
        type: 'MATCH_FEATURES',
        instruction: 'Which feature does the guide mention for each place? Choose FOUR answers from the box.',
        shared: { options: opts('wild flowers', 'a waterfall', 'old stone walls', 'a view of the sea', 'rare birds', 'a shop') },
        questions: [ch('North Ridge', 'D'), ch('Mill Wood', 'A'), ch('Fox Valley', 'B'), ch('High Farm', 'C')],
      },
    ],
  },
  {
    title: 'Planning a group project',
    content: '<p>Two students and their tutor discuss a project on city transport.</p>',
    groups: [
      {
        type: 'MCQ_MULTI',
        instruction: 'Choose TWO letters, A–E.',
        questions: [
          ch('Which TWO problems do the students mention?', ['B', 'D'], opts('cost of tickets', 'late buses', 'too few cycle lanes', 'crowded trains', 'dirty stations')),
          ch('Which TWO sources will they use?', ['A', 'E'], opts('a council report', 'a TV programme', 'social media', 'a newspaper', 'a survey of students')),
        ],
      },
      {
        type: 'MATCH_FEATURES',
        instruction: 'Who will do each task? Write the correct letter, A, B or C.',
        shared: { options: opts('Maya', 'Leon', 'both students') },
        questions: [ch('design the survey', 'A'), ch('interview drivers', 'B'), ch('find statistics', 'A'), ch('write the summary', 'C'), ch('make the slides', 'B'), ch('present the findings', 'C')],
      },
    ],
  },
  {
    title: 'A lecture on urban trees',
    content: '<p>A lecturer talks about the value of trees in cities.</p>',
    groups: [
      {
        type: 'SENTENCE_COMPLETION',
        instruction: 'Complete the sentences below. Write ONE WORD ONLY for each answer.',
        word_limit: 1,
        questions: [
          sa('Trees lower the temperature of streets in ___.', ['summer']),
          sa('Leaves catch ___ from traffic.', ['dust']),
          sa('Roots help to control ___ after storms.', ['flooding', 'floods']),
          sa('Shops on tree-lined streets earn more ___.', ['money', 'income']),
          sa('People walking under trees feel less ___.', ['stress']),
          sa('Young trees need regular ___ for three years.', ['watering', 'water']),
          sa('The most common city tree in the study was the ___.', ['plane']),
          sa('Old trees store more ___ than young ones.', ['carbon']),
          sa('Residents can ask the council for a free ___.', ['tree', 'sapling']),
          sa('The lecturer ends by asking for more ___.', ['research']),
        ],
      },
    ],
  },
];

const passage = (...paragraphs) => paragraphs.map((p, i) => `<p><strong>${String.fromCharCode(65 + i)}</strong> ${p}</p>`).join('');

const READING = [
  {
    title: 'The return of urban beekeeping',
    content: passage(
      'Twenty years ago, few people would have imagined bees living on the roofs of offices and hotels. Today, hives can be found on rooftops in many large cities, where volunteers and companies keep them for honey and for the pleasure of looking after them.',
      'City bees often do surprisingly well. Parks, gardens, street trees and window boxes offer a long season of flowers, and cities are usually a little warmer than the countryside around them, so bees can collect food earlier in spring and later in autumn.',
      'However, some scientists warn that adding too many honeybee hives may harm wild bees, which compete for the same flowers. In one study of a European capital, the number of hives tripled in ten years while the number of flowers stayed about the same.',
      'Supporters reply that the answer is not fewer hives but more flowers. They encourage councils to plant wild flowers along roads and to cut grass less often, which helps all kinds of insects, not only honeybees.',
      'Many urban beekeepers say the greatest benefit is educational. Visitors who see a working hive often become more interested in where their food comes from, and some schools now keep bees as part of their science teaching.',
    ),
    groups: [
      {
        type: 'TFNG',
        instruction: 'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.',
        questions: [
          ch('Hives are now found on the roofs of hotels.', 'TRUE'),
          ch('Cities are usually colder than the countryside nearby.', 'FALSE'),
          ch('City bees can collect food for a longer season.', 'TRUE'),
          ch('Honey from city bees tastes better than country honey.', 'NOT GIVEN'),
          ch('In one city, the number of flowers tripled in ten years.', 'FALSE'),
          ch('Cutting grass less often helps insects.', 'TRUE'),
          ch('Most schools in Europe keep bees.', 'NOT GIVEN'),
        ],
      },
      {
        type: 'SHORT_ANSWER',
        instruction: 'Answer the questions below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
        word_limit: 2,
        questions: [
          sa('Who, apart from companies, keeps hives in cities?', ['volunteers']),
          sa('Which planted feature, besides gardens and parks, gives bees flowers?', ['street trees', 'window boxes']),
          sa('Which bees may suffer from too many honeybee hives?', ['wild bees']),
          sa('What do supporters want councils to plant along roads?', ['wild flowers']),
          sa('What do beekeepers call the greatest benefit?', ['educational']),
          sa('In which subject do some schools use bees?', ['science', 'science teaching']),
        ],
      },
    ],
  },
  {
    title: 'Why we remember stories',
    content: passage(
      'People have told stories for as long as they have had language. Researchers now believe that stories are not simply entertainment but a powerful way of storing and sharing knowledge.',
      'When information is presented as a story, listeners remember far more of it. In one experiment, students who heard facts inside a short story recalled twice as many of them a week later as students who read the same facts as a list.',
      'One explanation is that stories connect facts to feelings. When we care about a character, the brain marks the events as important and is more likely to keep them.',
      'Stories also give information a shape. A beginning, a problem and an ending act like shelves on which details can be placed, so they are easier to find again later.',
      'Teachers and doctors have begun to use these findings. Some medical schools now teach difficult cases through the stories of patients, and many science teachers open lessons with a short account of a discovery.',
    ),
    groups: [
      {
        type: 'MATCH_HEADINGS',
        instruction: 'The passage has five paragraphs, A–E. Choose the correct heading for each paragraph from the list of headings below.',
        shared: {
          options: [
            { key: 'i', text: 'Using stories in professional training' },
            { key: 'ii', text: 'An ancient habit with a serious purpose' },
            { key: 'iii', text: 'Emotions help memory' },
            { key: 'iv', text: 'Evidence from a classroom test' },
            { key: 'v', text: 'A structure that organises details' },
            { key: 'vi', text: 'Why lists are better than stories' },
          ],
        },
        questions: [ch('Paragraph A', 'ii'), ch('Paragraph B', 'iv'), ch('Paragraph C', 'iii'), ch('Paragraph D', 'v'), ch('Paragraph E', 'i')],
      },
      {
        type: 'SUMMARY_COMPLETION',
        instruction: 'Complete the summary using the list of words, A–F, below.',
        shared: {
          options: opts('feelings', 'shelves', 'twice', 'patients', 'lists', 'entertainment'),
          text: 'Stories are more than [[1]]. Students remembered [[2]] as many facts from a story, because stories link facts to [[3]] and give them a shape, like [[4]] for details.',
        },
        questions: [ch(null, 'F'), ch(null, 'C'), ch(null, 'A'), ch(null, 'B')],
      },
      {
        type: 'MCQ_SINGLE',
        instruction: 'Choose the correct letter, A, B, C or D.',
        questions: [
          ch('In the experiment, students were tested after', 'C', opts('one day', 'three days', 'one week', 'one month')),
          ch('According to the passage, caring about a character', 'B', opts('slows reading', 'marks events as important', 'causes confusion', 'reduces attention')),
          ch('Some medical schools teach difficult cases through', 'D', opts('lists of facts', 'short tests', 'online videos', 'patients’ stories')),
          ch('The writer’s main purpose is to', 'A', opts('explain why stories help memory', 'compare books and films', 'criticise teachers', 'describe one experiment only')),
        ],
      },
    ],
  },
  {
    title: 'Working four days a week',
    content: passage(
      'In recent years a number of companies have tried letting staff work four days a week for the same pay. The idea is that people who are well rested work more efficiently and make fewer mistakes.',
      'Early results have been encouraging. In a trial involving sixty companies, most reported that output stayed the same or rose, and almost all chose to keep the shorter week after the trial ended.',
      'Not every job fits the model easily. Hospitals, schools and shops must stay open, so they cannot simply close for a day; instead they need careful rotas so that a shorter week for each person does not mean shorter opening hours.',
      'Critics argue that the trials attracted companies that were already likely to succeed, and that the results may not apply to the whole economy. They also point out that some staff found the four longer days tiring.',
      'Even so, many employers believe that the way people work is changing for good, and that time, not only money, will become a key way of attracting staff.',
    ),
    groups: [
      {
        type: 'YNNG',
        instruction: 'Do the following statements agree with the views of the writer? Write YES, NO or NOT GIVEN.',
        questions: [
          ch('Well-rested staff tend to make fewer mistakes.', 'YES'),
          ch('Most companies in the trial went back to a five-day week.', 'NO'),
          ch('Every type of job can easily move to a four-day week.', 'NO'),
          ch('The trials will soon be repeated in other countries.', 'NOT GIVEN'),
          ch('Some workers found longer days tiring.', 'YES'),
          ch('Pay will soon matter less to workers than time.', 'NOT GIVEN'),
        ],
      },
      {
        type: 'SENTENCE_COMPLETION',
        instruction: 'Complete the sentences below. Choose ONE WORD ONLY from the passage for each answer.',
        word_limit: 1,
        questions: [
          sa('The trial included ___ companies.', ['sixty', '60']),
          sa('Hospitals need careful ___ to stay open.', ['rotas']),
          sa('Critics say the results may not apply to the whole ___.', ['economy']),
          sa('Employers see ___ as a way of attracting staff.', ['time']),
        ],
      },
      {
        type: 'MCQ_SINGLE',
        instruction: 'Choose the correct letter, A, B, C or D.',
        questions: [
          ch('In the trial, output mostly', 'B', opts('fell sharply', 'stayed the same or rose', 'could not be measured', 'fell slightly')),
          ch('Shops cannot simply', 'A', opts('close for a day', 'hire more staff', 'raise prices', 'open later')),
          ch('Critics say the companies in the trials', 'D', opts('paid less', 'were very large', 'were all in one city', 'were already likely to succeed')),
          ch('The writer’s attitude to the four-day week is', 'C', opts('strongly against', 'not stated', 'cautiously positive', 'completely uncertain')),
        ],
      },
    ],
  },
];

const WRITING = [
  '<p>You should spend about 20 minutes on this task.</p><p>The chart below shows the number of visitors to a city museum in six months of one year.</p><p>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</p><p>Write at least 150 words.</p>',
  '<p>You should spend about 40 minutes on this task.</p><p>Some people believe that working from home is better for both employees and employers. Others think that people work best in an office.</p><p>Discuss both views and give your own opinion.</p><p>Write at least 250 words.</p>',
];
const SPEAKING = [
  '<p>Let’s talk about your home town.</p><ul><li>Where is your home town?</li><li>What do you like most about it?</li><li>How has it changed in recent years?</li><li>Do you prefer living in a town or the countryside? Why?</li></ul>',
  '<p><strong>Describe a book you enjoyed reading.</strong></p><p>You should say:</p><ul><li>what the book was</li><li>when you read it</li><li>what it was about</li></ul><p>and explain why you enjoyed it.</p>',
  '<p>Let’s talk about reading in general.</p><ul><li>Do people read less than they used to?</li><li>Should schools encourage reading for pleasure? How?</li><li>Will printed books disappear in the future?</li></ul>',
];

/** A Task 2 script, about 260 words; `twin` makes a near copy for the plagiarism demo. */
const essay = (who, twin = false) => {
  const open = twin
    ? 'Nowadays more and more people are able to work from home, and this has created a lively debate about whether it is better than working in an office.'
    : `Many people today, like ${who}, have tried working from home, and opinions about it are divided.`;
  return [
    open,
    'On the one hand, working from home saves a great deal of time and money that would otherwise be spent on travelling to work every day, and many employees say they can concentrate better without the noise and interruptions of a busy office.',
    'Employers can also benefit, because they need less office space and can hire talented staff who live far away from the city.',
    'On the other hand, an office makes it easier for colleagues to share ideas, solve problems quickly and build friendly relationships, and young employees in particular may learn more by watching experienced colleagues at work.',
    'Some people also find it difficult to separate their working life from their home life, so they end up working longer hours and feeling more tired.',
    twin
      ? 'In my opinion, the best solution is a mixture of both, where employees spend some days at home and some days in the office, because this keeps the advantages of each.'
      : `In my view, ${who.split(' ')[0]} is right that a flexible mix of home and office work suits most people, as long as teams meet regularly in person.`,
    'In conclusion, although working from home has clear advantages, offices still play an important role, and companies should find a balance that suits their staff.',
  ].join('\n\n');
};
const report = (who) =>
  `The bar chart shows how many people visited a city museum in six months of one year. Overall, visitor numbers rose steadily in the first half of the period and then fell in the last two months. In January the museum had about 2,000 visitors, and this figure grew each month until it reached a peak of around 5,500 in April. The number stayed high in May at roughly 5,000 before dropping sharply to about 3,000 in June. ${who.split(' ')[0]} notes that the busiest months were in spring, which may be because of school holidays and better weather. In general, the museum attracted more than twice as many visitors at its peak as at the start of the year.`;

// ------------------------------------------------------------------ helpers

const flatQuestions = (parts) => parts.flatMap((p) => p.groups.flatMap((g) => g.questions.map((q) => ({ ...q, type: g.type, options: q.options ?? g.shared?.options ?? null }))));
const FIXED = { TFNG: ['TRUE', 'FALSE', 'NOT GIVEN'], YNNG: ['YES', 'NO', 'NOT GIVEN'] };

/** A student's answer: right with the given chance, else a plausible wrong one. */
function answerFor(spec, right) {
  if ('accepted' in spec.answer) return right ? spec.answer.accepted[0] : 'not sure';
  const keys = spec.answer.keys;
  if (right) return [...keys].sort().join(',');
  const choices = (FIXED[spec.type] ?? (spec.options ?? []).map((o) => o.key)).filter((k) => !keys.includes(k));
  return spec.type === 'MCQ_MULTI' ? [keys[0], choices[0]].sort().join(',') : (choices[0] ?? keys[0]);
}

/** Deterministic "random" so a run gives the same answers each time. */
const chance = (seed) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

async function main() {
  const now = Date.now();
  const { token: plain } = await signIn('ielts.owner@yopmail.com');
  const contexts = await must('GET', '/auth/contexts', plain);
  const centre = contexts.find((c) => c.type === 'organization' && c.label === CENTRE);
  if (!centre) throw new Error(`${CENTRE} not found: run the test seed first`);
  const orgId = centre.organization_id;
  const owner = await inCentre('ielts.owner@yopmail.com', orgId);
  const teacher = await inCentre('ielts.teacher1@yopmail.com', orgId);
  const marker = await inCentre('ielts.teacher2@yopmail.com', orgId);
  const O = api(owner);
  const T = api(teacher);

  await O.get('/setup');
  const type = await O.get('/workspace/type');
  if (type.workspace_type !== 'IELTS') throw new Error('The centre is not an IELTS workspace');

  // Courses (classes) with one batch (section A) each, and their students.
  const COURSES = [
    { name: 'Band 7 Academic', students: [1, 2, 3, 4, 5, 6, 7, 8], test_type: 'ACADEMIC' },
    { name: 'General Training', students: [9, 10, 11, 12], test_type: 'GENERAL' },
  ];
  const email = (n) => `ielts.student${String(n).padStart(2, '0')}@yopmail.com`;
  let classes = await O.get('/classes');
  for (const course of COURSES) {
    if (!classes.some((c) => c.class_name === course.name)) {
      await O.post('/classes', { class_name: course.name });
      tally('courses');
    }
  }
  classes = await O.get('/classes');
  const batch = {};
  for (const course of COURSES) {
    const klass = classes.find((c) => c.class_name === course.name);
    await O.post(`/classes/${klass.id}/students`, { students: course.students.map(email) });
    const [section] = await O.get(`/classes/${klass.id}/sections`);
    batch[course.name] = section.id;
  }

  // Every student signs in once (their sign-in gives their user id).
  const who = {};
  for (let n = 1; n <= 12; n += 1) who[n] = await inCentre(email(n), orgId);
  const profiles = await O.get('/ielts/profiles');
  const names = Object.fromEntries(Object.keys(who).map((n) => [n, profiles.find((p) => p.student.id === who[n].id)?.student.full_name ?? 'The student']));
  const numberOf = (studentId) => Number(Object.keys(who).find((n) => who[n].id === studentId));

  // Profiles: test type, targets, booked test dates.
  for (const p of profiles) {
    if (p.test_type) continue;
    const n = numberOf(p.student.id);
    const academic = COURSES[0].students.includes(n);
    const target = [6.5, 7, 7.5, 6][n % 4];
    await O.put(`/ielts/profiles/${p.student.id}`, {
      test_type: academic ? 'ACADEMIC' : 'GENERAL',
      target_overall: target,
      target_bands: { LISTENING: Math.min(9, target + 0.5), READING: target, WRITING: target - 0.5, SPEAKING: target },
      test_date: new Date(now + (25 + n * 9) * DAY).toISOString().slice(0, 10),
    });
    tally('profiles');
  }

  // Tests. The Academic mock: four Listening recordings and a Writing chart are generated here.
  const tests = await T.get('/ielts/tests');
  const find = (title) => tests.find((t) => t.title === title);
  const ensureTest = async (title, body, fill) => {
    const existing = find(title);
    if (existing) return T.get(`/ielts/tests/${existing.id}`);
    const test = await T.post('/ielts/tests', { title, ...body });
    await fill(test);
    tally('tests');
    return T.get(`/ielts/tests/${test.id}`);
  };
  const addGroups = async (test, part, groups) => {
    for (const g of groups) await T.post(`/ielts/tests/${test.id}/parts/${part.id}/groups`, g);
  };
  const partOf = (test, module, no) => test.parts.find((p) => p.module === module && p.part_no === no);

  const mock = await ensureTest('Academic Mock 1', { test_type: 'ACADEMIC', purpose: 'MOCK' }, async (test) => {
    for (const [i, spec] of LISTENING.entries()) {
      const part = partOf(test, 'LISTENING', i + 1);
      const audio = await upload(teacher, `listening-part-${i + 1}.wav`, 'audio/wav', wav(6, 330 + i * 60));
      await T.put(`/ielts/tests/${test.id}/parts/${part.id}`, { title: spec.title, content: spec.content, audio_file_id: audio });
      await addGroups(test, part, spec.groups);
    }
    for (const [i, spec] of READING.entries()) {
      const part = partOf(test, 'READING', i + 1);
      await T.put(`/ielts/tests/${test.id}/parts/${part.id}`, { title: spec.title, content: spec.content });
      await addGroups(test, part, spec.groups);
    }
    const chart = await upload(teacher, 'museum-visitors.png', 'image/png', barChart([2000, 3100, 4200, 5500, 5000, 3000]));
    await T.put(`/ielts/tests/${test.id}/parts/${partOf(test, 'WRITING', 1).id}`, { content: WRITING[0], image_file_id: chart });
    await T.put(`/ielts/tests/${test.id}/parts/${partOf(test, 'WRITING', 2).id}`, { content: WRITING[1] });
    for (let n = 1; n <= 3; n += 1) await T.put(`/ielts/tests/${test.id}/parts/${partOf(test, 'SPEAKING', n).id}`, { content: SPEAKING[n - 1] });
    await T.post(`/ielts/tests/${test.id}/publish`);
  });

  const readingSet = await ensureTest('Reading practice: urban beekeeping', { test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'READING', part_nos: [1] }, async (test) => {
    const part = test.parts[0];
    await T.put(`/ielts/tests/${test.id}/parts/${part.id}`, { title: READING[0].title, content: READING[0].content });
    await addGroups(test, part, READING[0].groups);
    await T.post(`/ielts/tests/${test.id}/publish`);
  });
  const writingSet = await ensureTest('Writing Task 2 practice: working from home', { test_type: 'GENERAL', purpose: 'PRACTICE', module: 'WRITING', part_nos: [2] }, async (test) => {
    await T.put(`/ielts/tests/${test.id}/parts/${test.parts[0].id}`, { content: WRITING[1] });
    await T.post(`/ielts/tests/${test.id}/publish`);
  });
  const speakingSet = await ensureTest('Speaking practice: books and reading', { test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'SPEAKING', part_nos: [1, 2, 3] }, async (test) => {
    for (const part of test.parts) await T.put(`/ielts/tests/${test.id}/parts/${part.id}`, { content: SPEAKING[part.part_no - 1] });
    await T.post(`/ielts/tests/${test.id}/publish`);
  });
  await ensureTest('General Training Mock 1 (draft)', { test_type: 'GENERAL', purpose: 'MOCK', modules: ['LISTENING', 'READING'] }, async (test) => {
    await T.put(`/ielts/tests/${test.id}/parts/${partOf(test, 'READING', 1).id}`, { title: READING[2].title, content: READING[2].content });
    await addGroups(test, partOf(test, 'READING', 1), READING[2].groups.slice(0, 1));
  });

  // Openings: the mock and practice sets open now; another mock opening next week (dashboard).
  const open = async (test, sectionId, from, to) => {
    const existing = await T.get(`/ielts/tests/${test.id}/assignments`);
    const found = existing.find((a) => a.section.id === sectionId && Math.abs(new Date(a.opens_at).getTime() - from) < DAY);
    if (found) return found;
    tally('openings');
    return T.post(`/ielts/tests/${test.id}/assignments`, { section_id: sectionId, opens_at: new Date(from).toISOString(), closes_at: new Date(to).toISOString() });
  };
  const academic = batch['Band 7 Academic'];
  const general = batch['General Training'];
  const mockOpening = await open(mock, academic, now - DAY, now + 3 * DAY);
  await open(mock, general, now + 6 * DAY, now + 7 * DAY);
  const readingOpening = await open(readingSet, academic, now - 2 * DAY, now + 10 * DAY);
  await open(readingSet, general, now - 2 * DAY, now + 10 * DAY);
  const writingOpening = await open(writingSet, academic, now - 2 * DAY, now + 5 * DAY);
  const speakingOpening = await open(speakingSet, academic, now - DAY, now + 5 * DAY);

  // Students take tests. Abilities give different bands; students 7–8 have not started the mock.
  const ability = { 1: 0.9, 2: 0.75, 3: 0.65, 4: 0.82, 5: 0.55, 6: 0.7, 7: 0.6, 8: 0.5 };
  const take = async (n, opening, module, specParts) => {
    const S = api(who[n]);
    const mine = await S.get('/ielts/my/assignments');
    const row = mine.find((a) => a.id === opening.id);
    if (row?.attempts?.[module] && row.attempts[module].status !== 'IN_PROGRESS') return row.attempts[module].id;
    const view = await S.post(`/ielts/my/assignments/${opening.id}/modules/${module}/start`);
    if (module === 'WRITING') {
      const answers = view.parts.map((p) => ({ part_id: p.id, answer: p.part_no === 1 ? report(names[n] ?? 'The student') : essay(names[n] ?? 'The student', n === 2 || n === 5) }));
      await S.post(`/ielts/my/attempts/${view.attempt.id}/submit`, { answers });
    } else {
      const paper = view.parts.flatMap((p) => p.groups.flatMap((g) => g.questions));
      const specs = flatQuestions(specParts);
      const answers = paper.map((q, i) => ({ question_id: q.id, answer: answerFor(specs[i], chance(n * 100 + i + module.length) < ability[n]) }));
      await S.post(`/ielts/my/attempts/${view.attempt.id}/submit`, { answers });
    }
    tally(`attempts ${module.toLowerCase()}`);
    return view.attempt.id;
  };
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await take(n, mockOpening, 'LISTENING', LISTENING);
    await take(n, mockOpening, 'READING', READING);
    await take(n, mockOpening, 'WRITING', null);
  }
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) await take(n, readingOpening, 'READING', [READING[0]]);
  for (const n of [2, 3, 5]) await take(n, writingOpening, 'WRITING', null);

  // Writing marks: mock Writing for students 1–4 (5–6 wait), practice for student 3.
  const M = api(marker);
  const results = await T.get(`/ielts/assignments/${mockOpening.id}/results`);
  const writingBands = { 1: [7, 7.5], 2: [6, 6.5], 3: [6, 6], 4: [6.5, 7] };
  for (const r of results) {
    const n = numberOf(r.student.id);
    const attempt = r.modules.WRITING;
    if (!attempt || !writingBands[n] || attempt.status === 'MARKED') continue;
    const view = await M.get(`/ielts/marking/${attempt.attempt_id}`);
    const [t1, t2] = writingBands[n];
    await M.put(`/ielts/marking/${attempt.attempt_id}/writing`, {
      tasks: view.tasks.map((task) => ({
        part_id: task.part_id,
        criteria: task.part_no === 1 ? { TA: t1, CC: t1, LR: t1, GRA: t1 - 0.5 } : { TR: t2, CC: t2, LR: t2 - 0.5, GRA: t2 },
        comment: task.part_no === 1 ? 'Give a clear overview of the main trend.' : 'Develop each main idea with an example.',
      })),
      feedback: 'Good range of vocabulary. Check articles and plurals.',
    });
    tally('writing marked');
  }
  const practice = await T.get(`/ielts/assignments/${writingOpening.id}/results`);
  const p3 = practice.find((r) => r.student.id === who[3].id)?.modules.WRITING;
  if (p3 && p3.status !== 'MARKED') {
    const view = await M.get(`/ielts/marking/${p3.attempt_id}`);
    await M.put(`/ielts/marking/${p3.attempt_id}/writing`, { tasks: view.tasks.map((task) => ({ part_id: task.part_id, criteria: { TR: 6, CC: 6.5, LR: 6, GRA: 6 } })) });
    tally('writing marked');
  }

  // Speaking: live sessions with the examiner for students 1–3 (marked), practice recordings by student 4 (waiting).
  const speakingBands = { 1: [7, 7, 6.5, 7.5], 2: [6, 6.5, 6, 6], 3: [6.5, 6, 6, 6.5] };
  const sResults = await T.get(`/ielts/assignments/${mockOpening.id}/results`);
  for (const n of [1, 2, 3]) {
    const row = sResults.find((r) => r.student.id === who[n].id);
    if (row?.modules.SPEAKING?.status === 'MARKED') continue;
    const session = await T.post(`/ielts/assignments/${mockOpening.id}/speaking`, { student_id: who[n].id });
    if (n === 1) {
      const rec = await upload(teacher, 'speaking-part-2.wav', 'audio/wav', wav(5, 220));
      await T.put(`/ielts/marking/${session.attempt_id}/recordings`, { part_id: session.tasks.find((t) => t.part_no === 2).part_id, file_id: rec });
    }
    const [fc, lr, gra, p] = speakingBands[n];
    await T.put(`/ielts/marking/${session.attempt_id}/speaking`, { criteria: { FC: fc, LR: lr, GRA: gra, P: p }, feedback: 'Extend your Part 3 answers with reasons and examples.' });
    tally('speaking marked');
  }
  {
    const S = api(who[4]);
    const mine = await S.get('/ielts/my/assignments');
    const row = mine.find((a) => a.id === speakingOpening.id);
    if (!row?.attempts?.SPEAKING) {
      const view = await S.post(`/ielts/my/assignments/${speakingOpening.id}/modules/SPEAKING/start`);
      for (const part of view.parts) {
        const rec = await upload(who[4], `part-${part.part_no}.wav`, 'audio/wav', wav(4, 260 + part.part_no * 40));
        await S.put(`/ielts/my/attempts/${view.attempt.id}/recordings`, { part_id: part.id, file_id: rec });
      }
      await S.post(`/ielts/my/attempts/${view.attempt.id}/submit`, {});
      tally('speaking practice handed in');
    }
  }

  // Plagiarism: the Writing practice (students 2 and 5 wrote almost the same essay).
  const check = await T.post('/integrity/checks', { scope_type: 'IELTS_WRITING', scope_id: writingOpening.id });
  tally('plagiarism pairs', check.matches.length);

  const final = await T.get(`/ielts/assignments/${mockOpening.id}/results`);
  console.log('Done:', JSON.stringify(count));
  console.log('Mock overall bands:', final.map((r) => r.overall).filter((b) => b !== null).join(', ') || 'none yet');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
