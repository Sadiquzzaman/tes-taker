import { describe, expect, it } from "vitest";
import { answerKey, paperSet, seededShuffle } from "./paperSets";

const option = (id: string) => ({ id, text: id.toUpperCase(), image: null });
const mcq = (id: string, correct: string, subType = "multiple-choice") =>
  ({
    id,
    type: "graded",
    subType,
    text: `Question ${id}`,
    instruction: null,
    image: null,
    points: 1,
    showValidation: false,
    options: ["a", "b", "c", "d"].map((o) => option(`${id}-${o}`)),
    correctOptionId: `${id}-${correct}`,
  }) as unknown as StudentExamStandardQuestion;
const matching = {
  id: "m1",
  type: "graded",
  subType: "matching-ordering",
  text: "Match",
  instruction: null,
  image: null,
  points: 3,
  showValidation: false,
  matchingOptions: { left: ["x", "y", "z"].map((o) => option(`l-${o}`)), right: ["x", "y", "z"].map((o) => option(`r-${o}`)) },
} as unknown as StudentExamStandardQuestion;
const essay = { id: "e1", type: "ungraded", subType: "essay", text: "Explain", instruction: null, image: null, points: 5, showValidation: false } as unknown as StudentExamStandardQuestion;
const subjects: StudentExamSubject[] = [
  { id: "s1", name: "Physics", code: null, questions: [mcq("q1", "b"), mcq("q2", "d"), mcq("q3", "a"), mcq("q4", "c"), mcq("tf", "a", "true-false"), matching, essay] },
];
const ids = (subject: StudentExamSubject) => subject.questions.map((q) => q.id);
const optionIds = (subject: StudentExamSubject, id: string) => (subject.questions.find((q) => q.id === id) as StudentExamStandardQuestion).options!.map((o) => o.id);

describe("paper sets (QA-05)", () => {
  it("is the same every time for the same exam and set", () => {
    expect(seededShuffle([1, 2, 3, 4, 5], "x", "y")).toEqual(seededShuffle([1, 2, 3, 4, 5], "x", "y"));
    expect(paperSet(subjects, "exam-1", "B")).toEqual(paperSet(subjects, "exam-1", "B"));
  });

  it("keeps the teacher's order in set A and shuffles questions and options in B and C", () => {
    const [a] = paperSet(subjects, "exam-1", "A");
    expect(ids(a)).toEqual(ids(subjects[0]));
    expect(optionIds(a, "q1")).toEqual(["q1-a", "q1-b", "q1-c", "q1-d"]);

    const [b] = paperSet(subjects, "exam-1", "B");
    const [c] = paperSet(subjects, "exam-1", "C");
    expect(new Set(ids(b))).toEqual(new Set(ids(subjects[0])));
    // With 7 questions and 4 options each, B and C differ from A and from each other somewhere.
    const order = (s: StudentExamSubject) => JSON.stringify([ids(s), ...["q1", "q2", "q3", "q4"].map((id) => optionIds(s, id))]);
    expect(new Set([order(a), order(b), order(c)]).size).toBe(3);
    // True / False keeps its order.
    expect(optionIds(b, "tf")).toEqual(["tf-a", "tf-b", "tf-c", "tf-d"]);
  });

  it("never prints a matching question with its answer in place, in any set", () => {
    for (const set of ["A", "B", "C"] as const) {
      const [paper] = paperSet(subjects, "exam-1", set);
      const right = (paper.questions.find((q) => q.id === "m1") as StudentExamStandardQuestion).matchingOptions!.right.map((o) => o.id);
      expect(right).not.toEqual(["r-x", "r-y", "r-z"]);
    }
  });

  it("gives each set's answer key with the letters as printed", () => {
    for (const set of ["A", "B"] as const) {
      const printed = paperSet(subjects, "exam-1", set);
      const [{ rows }] = answerKey(printed, subjects);
      const paper = printed[0];
      // The paper groups multiple choice first, then true/false, matching, essay.
      const mcqs = paper.questions.filter((q) => (q as StudentExamStandardQuestion).subType === "multiple-choice") as StudentExamStandardQuestion[];
      mcqs.forEach((question, i) => {
        const letter = "ABCD"[question.options!.findIndex((o) => o.id === question.correctOptionId)];
        expect(rows[i]).toEqual({ number: i + 1, answer: letter });
      });
      expect(rows[4]).toEqual({ number: 5, answer: "A" });
      const printedRight = (paper.questions.find((q) => q.id === "m1") as StudentExamStandardQuestion).matchingOptions!.right;
      const letterOf = (id: string) => "ABC"[printedRight.findIndex((o) => o.id === id)];
      expect(rows[5]).toEqual({ number: 6, answer: `1-${letterOf("r-x")}, 2-${letterOf("r-y")}, 3-${letterOf("r-z")}` });
      expect(rows[6]).toEqual({ number: 7, answer: null });
    }
  });
});
