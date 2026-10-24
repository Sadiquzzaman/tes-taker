# Instructor — UI design system

From Development Plan v1 §3.

## UI direction and design-system brief

The UI gets better by building **one design system first (P1)** and then rebuilding every screen on it. Polishing screens one by one doesn't work. Today's code has 95 hard-coded colours, 14 ad-hoc font sizes and 285 raw buttons. This section is written for Claude Code: save it as `docs/ui/design-system.md`, and every UI package follows it.

### 3.1 Direction

- **Feel: calm, trustworthy, fast to scan.** Teachers use it between classes; owners show it to parents. Avoid slideware gradients and heavy shadows.
- **Keep the brand green.** `#49734F` stays the primary colour. Warm off-white canvas, white cards, one attention colour (amber) for things that need action today.
- **Bangla-first typography.** Bangla text must never look like an afterthought: proper font, larger line height, Bangla digits when the user picks Bangla.
- **Mobile-first.** Most students and many teachers are on phones. Every screen is designed at 375 px first, then widened.

### 3.2 Tokens

All tokens are defined once in `frontend/design/tokens.json` and generated into Tailwind `@theme` (web, `frontend/app/tokens.css`) and `ThemeData` (Flutter, from P4). Nothing outside the token file uses a raw value.

| Group | Tokens |
| --- | --- |
| Colour — brand | `primary` #49734F (existing), `primary-hover` #3D6242 (existing), `primary-soft` (tint for selected rows and badges) |
| Colour — text | `ink` #232A25 (existing), `ink-muted` #6B6E6C (was #747775, darkened to pass WCAG AA on canvas and primary-soft), `ink-inverse` |
| Colour — surfaces | `canvas` (warm off-white), `surface` (white), `surface-raised`, `border` #E5E5E5 (existing) |
| Colour — status | `success`, `warning` (amber, "needs action"), `danger`, `info`, each with a soft background |
| Type | Latin: Instrument Sans (existing brand). Bangla: Hind Siliguri. Marketing headings only: DM Serif Display. Scale: 12 / 14 / 16 / 20 / 24 / 32; line height 1.5 Latin, 1.7 Bangla |
| Spacing | 4-point scale: 4, 8, 12, 16, 24, 32, 48 |
| Radius | 6 (inputs), 10 (cards), 16 (sheets and modals), full (pills) |
| Elevation | 2 levels only: card and overlay |
| Motion | 150 ms ease-out for hover and focus; 250 ms for sheets; respects reduced motion |

Dark mode: tokens are named by role (not by colour), so it can be added later without touching screens.

### Using the tokens (built in P1-01)

- **Edit** `frontend/design/tokens.json`, then run `pnpm tokens` in `frontend/` to regenerate `app/tokens.css`. Never edit `tokens.css` by hand; CI fails if it is out of date (`pnpm tokens:check`, also a frontend test).
- **Classes** (Tailwind v4): colours `bg-primary`, `bg-primary-soft`, `text-ink`, `text-ink-muted`, `text-ink-inverse`, `bg-canvas`, `bg-surface`, `border-border`, and `text-`/`bg-` for `success`, `warning`, `danger`, `info` (+ `-soft`); type `text-caption` (12), `text-body-sm` (14), `text-body` (16), `text-title-sm` (20), `text-title` (24), `text-display` (32), each with its line height; radius `rounded-input`, `rounded-card`, `rounded-sheet`; elevation `shadow-card`, `shadow-overlay`; motion `ease-fast` / `ease-sheet` with `duration-(--motion-fast)` / `duration-(--motion-sheet)`; fonts `font-sans` (default), `font-bangla`, `font-display` (marketing headings only). Spacing uses Tailwind's default 4 px scale (`p-1` = 4, `p-2` = 8, … `p-12` = 48).
- **Bangla:** `font-sans` falls back to Hind Siliguri for Bangla characters. The 1.7 line height for Bangla (`--leading-bangla`) is applied with the language switch in P1-04.
- **Contrast:** every text colour is tested against the backgrounds it is used on (WCAG AA, 4.5:1) in `design/tokens.test.ts`; add a pair there when you introduce a new combination.
- **Motion:** animations and transitions are switched off when the user prefers reduced motion (`app/globals.css`).
- Existing screens still use hard-coded values; they move onto the tokens in P1-05.

### 3.3 Components (build in P1, in this order)

1. Button, IconButton, Link
2. Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, DatePicker, TimePicker, FileDrop (with the compression progress from FND-15)
3. Card, StatTile, Badge/StatusPill, Avatar, Tag
4. Table with sorting, filters, empty and loading states, row selection and a mobile card view
5. Tabs, Breadcrumb, Pagination, Stepper (for wizards)
6. Modal, Drawer (forms open in drawers), Sheet (mobile), Toast, Confirm dialog
7. EmptyState (illustration + one action), Skeleton, ErrorState with retry
8. Layout: AppShell (sidebar by role and feature switches, top bar with org switcher, bell, language toggle), PageHeader, FilterBar

A `/dev/ui` page shows every component in every state. Claude Code screenshots it at the end of P1 for your review.

### 3.4 Screen patterns

| Pattern | Rule | Used by |
| --- | --- | --- |
| Home = "Today" | Top strip shows what needs action now: classes now and next, roll calls not taken, leave to approve, work to mark, live exams. Charts sit below | Teacher, admin, owner, student homes |
| One-tap roll call | Everyone starts Present; tap a student to cycle Absent → Late → Leave; one Save; works offline on mobile | ATT-07 |
| List → detail | Filterable list; the detail page has tabs; edits open in a drawer, never a new page | Classes, students, homework, exams |
| Side-by-side review | Source on the left (photo crop or submission), editable result on the right, flagged items highlighted amber | Syllabus import, homework marking, plagiarism |
| Live grid | Tiles with a status colour, sorted with problems first, click for a timeline | Proctoring live monitor, attendance today |
| Calm exam screen | Question navigator, answered/flagged states, a small proctoring status pill; warnings explained in one plain sentence | Exam taking |
| Wizard | Stepper, maximum 5 steps, a summary before finishing | Academic setup, exam builder, report-card run |

### 3.5 Quality bar for every UI package

- Built only from `frontend/ui` components and tokens. CI fails on raw hex values or `text-[Npx]`.
- Loading, empty, error and success states are designed, not left to chance.
- Works at 375, 768 and 1280 px. Tap targets are at least 44 px. Text contrast meets WCAG AA.
- Bangla and English both checked; long Bangla labels must not break layouts.
- Playwright screenshots at 375 and 1280 px are attached to the PR.

