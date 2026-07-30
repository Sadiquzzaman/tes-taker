# Editor v2 Implementation Report

Branch: `feature/editor-v2`  
Base: `develop`  
Date: 2026-07-30

## Summary

Instructor Academy’s TipTap Question Editor was upgraded into a production-oriented exam authoring surface: Word-like toolbar groups, rule-based paste/OCR parsing, MathLive equations, Excalidraw drawing, graphs, Kekule chemistry, richer images, instruction above the question, improved PDF fidelity, and a new graded **Answer Box** question type. Existing exams and APIs remain compatible.

## Features implemented

### 1. Word-like toolbar
- Grouped sections: **Formatting**, **Paragraph**, **Insert**, **Math**, **Drawing**, **Media**, **History**
- Instruction editor uses a lightweight `variant="lite"` toolbar (Formatting / Lists / History)

### 2. Automatic question parsing (rule-based, no AI)
- Parser: `frontend/utils/exam/parsePastedQuestion.ts`
- Detects question stem, options (A–H / 1–8), correct answer, explanation
- Wired on paste into the question editor and via OCR “Apply”
- Redux: `applyParsedQuestion` populates text, options, correct option, and instruction (from explanation)

### 3. Copy / paste fidelity
- TipTap HTML paste retained (bold, italic, underline, lists, tables, headings, links, images)
- Word/Office conditional comments stripped via `transformPastedHTML`
- Image paste / drag-and-drop still supported when image entitlements allow

### 4. Equation editing
- MathLive visual editor + KaTeX rendering (existing path retained)
- Existing math nodes remain clickable/editable
- Teachers do not need to type LaTeX manually

### 5. Drawing
- Excalidraw replaces the drawing placeholder path for freehand lines, arrows, shapes, and flowcharts
- Inserted as a resizable image into the editor
- GeoGebra remains available for geometry constructions

### 6. Graphs
- Function and coordinate graphs via **function-plot**
- Statistics bars and basic 3D surface via canvas helpers
- Captured and inserted as images (lazy-loaded modal)

### 7. Chemistry
- Kekule composer retained and kept under Drawing → Chemistry
- Structures / reactions exported as SVG or PNG into the editor

### 8. OCR
- **tesseract.js** (open source) extracts text from uploaded images
- Extracted text is parsed with the same rule-based parser and applied to the form

### 9. Rich images
- Upload, paste, drag-and-drop
- Resize handles, left/center/right alignment
- Editable captions (`data-caption`)

### 10. Instruction above Question
- Create UI order: Instruction → Question → options/answers → footer
- Lightweight TipTap variant for instruction
- DB column widened to `text` (migration below) so rich HTML is not truncated

### 11. PDF generation
- `renderPdfRichHtml` captures math, images, tables, and headings via KaTeX + html2canvas when rich markup is present
- Falls back to plain text for simple content
- Answer Box / fill-in blanks get answer lines

### 12. Answer Box (graded)
- New subtype: `answer-box`
- Teacher sets expected answer (+ alternatives)
- Student types in a text box
- Backend auto-scores like fill-in-the-blanks (case-insensitive exact match)
- Included in student view, grading input mode, PDF grouping, and wizard validation

### 13. Backward compatibility
- Existing subtypes unchanged
- No API contract removals
- Existing math/image HTML continues to render
- Instruction migration is widening-only (non-destructive)

## Libraries used (free / OSS)

| Capability | Library |
|------------|---------|
| Editor | TipTap + ProseMirror |
| Math | MathLive, KaTeX |
| Drawing | `@excalidraw/excalidraw` |
| Geometry | GeoGebra (CDN applet, existing) |
| Chemistry | Kekule.js |
| Graphs | function-plot + canvas |
| OCR | tesseract.js |
| PDF capture | jsPDF, html2canvas |

Heavy tools (MathLive, Excalidraw, GeoGebra, Kekule, Graph, OCR) are **dynamically imported / lazy-loaded**.

## Database changes

| Change | Detail |
|--------|--------|
| Table | `exam_questions` |
| Column | `instruction` |
| Before | `varchar(500)` |
| After | `text` |
| Migration | `backend/src/migrations/1754000000000-WidenExamQuestionInstruction.ts` |
| App code | Entity updated; save path no longer `slice(0, 500)` |

`synchronize` remains **false**. No other schema changes.

### Migration steps

```bash
cd backend
# ensure DATABASE_* env is set for the target environment
npm run typeorm migration:run
# or your project’s equivalent:
# pnpm typeorm migration:run -d src/data-source.ts
```

Verify:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'exam_questions' AND column_name = 'instruction';
```

Expect `text` (or `character varying` without a short length limit, depending on Postgres reporting).

## Breaking changes

**None intended.**

Notes:
- Teachers may paste structured MCQs and see options auto-filled (intentional).
- Very large inline data-URL drawings/graphs still face existing `image_url` length limits for **card-level** images; inline TipTap images live in question HTML (`text` column).
- Answer Box is additive; old exams without it are unaffected.

## Manual testing checklist

### Authoring
- [ ] MCQ create / edit / save / reload
- [ ] Multiple response
- [ ] True / False
- [ ] Fill in the Blanks
- [ ] Matching / Ordering
- [ ] Essay (ungraded)
- [ ] Passage / CQ children
- [ ] **Answer Box** create, expected answer, alternatives, publish
- [ ] Instruction appears **above** question and persists after reload
- [ ] Paste MCQ from Word / Docs / chatbot text → options + correct answer fill
- [ ] Paste formatted paragraph → bold/italic/lists/tables preserved
- [ ] Insert MathLive equation; reopen and edit
- [ ] Insert Excalidraw drawing
- [ ] Insert GeoGebra geometry
- [ ] Insert function / coordinate / statistics / 3D graph
- [ ] Insert Kekule structure
- [ ] OCR image → apply to question
- [ ] Image upload / paste / resize / align / caption

### Student / grading / PDF
- [ ] Student view: Answer Box textarea; submit
- [ ] Auto-score Answer Box (exact match, case-insensitive)
- [ ] Student view: existing MCQ / matching / FITB still work
- [ ] Teacher grading UI shows text mode for Answer Box / FITB
- [ ] Download questions PDF: math, images, tables visible when present
- [ ] Download results PDF still works

### Quality
- [ ] `frontend`: `npx tsc --noEmit` — pass
- [ ] `frontend`: eslint on changed editor paths — pass
- [ ] `frontend`: `npm run build` — pass
- [ ] `backend`: `npx tsc --noEmit` — pass
- [ ] Migration runs on staging / beta before promote

## Known limitations

1. **OCR quality** depends on image clarity; handwriting is unreliable with Tesseract.
2. **Parser** is rule-based — unusual layouts may not detect options/correct answers.
3. **3D graphs** are a basic canvas surface preview, not a full interactive 3D CAS.
4. **Options / matching rows** remain plain inputs (not TipTap), by design of the existing builder.
5. **Card-level `image_url`** is still `varchar(2048)` — prefer TipTap inline images for large figures.
6. Full-repo `npm run lint` still reports **pre-existing** issues outside Editor v2 files.
7. Excalidraw peer deps target React 16–18; works under React 19 in practice but watch for upstream updates.

## Key files

- `frontend/component/RichTextEditor/*`
- `frontend/utils/exam/parsePastedQuestion.ts`
- `frontend/utils/exam/pdf/renderPdfRichHtml.ts`
- `frontend/lib/features/create-test/applyParsedQuestion.ts`
- `frontend/utils/createTestOptions.ts`
- `backend/src/exams/enums/question.enums.ts`
- `backend/src/migrations/1754000000000-WidenExamQuestionInstruction.ts`
