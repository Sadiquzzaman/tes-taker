import React, { useEffect } from "react";

const GradingModel = ({ openModal, setOpenModal }: { openModal: string; setOpenModal: (open: string) => void }) => {
  useEffect(() => {
    if (openModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [openModal]);

  const handleClose = () => {
    setOpenModal("");
  };

  const allQuestion = template.subjects.map((sub) => {
    return {
      name: sub.name,
      qustionList: sub.questionSections
        .map((section) => {
          return section.questions.map((question) => {
            return { ...question, type: section.type };
          });
        })
        .flatMap((section) => section),
    };
  });

  console.log({ allQuestion });

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${openModal ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
        aria-hidden="true"
      >
        <div
          className={`absolute top-2 right-2 h-[calc(100vh-8px)] w-[calc(100vw-8px)] sm:w-[584px] z-50 bg-white rounded-xl p-4 sm:p-8 shadow-lg overflow-auto transition-transform duration-500 ${openModal ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
          style={{ maxHeight: "calc(100vh - 16px)" }}
          aria-modal="true"
          role="dialog"
        >
          <div className="flex justify-between items-center">
            <p className="font-[600] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">
              {openModal === "edit" ? "Grade Submission" : "View Result"}
            </p>
            <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {openModal === "result" && (
            <div className="flex justify-between items-center py-4">
              <p className="font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#747775]">Answer sheet</p>
              <div className="flex gap-4 items-center">
                <p className="font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#49734F]">Score: 24</p>
                <div
                  className="w-8 h-8 bg-[#EFF0F3] rounded-[6px] flex justify-center items-center cursor-pointer"
                  onClick={() => setOpenModal("edit")}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M6.9998 2.14355H3.22272C2.93651 2.14355 2.66202 2.25725 2.45964 2.45964C2.25725 2.66202 2.14355 2.93651 2.14355 3.22272V10.7769C2.14355 11.0631 2.25725 11.3376 2.45964 11.54C2.66202 11.7424 2.93651 11.8561 3.22272 11.8561H10.7769C11.0631 11.8561 11.3376 11.7424 11.54 11.54C11.7424 11.3376 11.8561 11.0631 11.8561 10.7769V6.9998"
                      stroke="#747775"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10.44 1.9417C10.6546 1.72704 10.9458 1.60645 11.2493 1.60645C11.5529 1.60645 11.8441 1.72704 12.0587 1.9417C12.2734 2.15636 12.394 2.4475 12.394 2.75107C12.394 3.05465 12.2734 3.34579 12.0587 3.56045L7.00013 8.61904L4.8418 9.15863L5.38138 7.00029L10.44 1.9417Z"
                      stroke="#747775"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
          {openModal === "result" && (
            <div className="flex flex-col gap-4">
              {allQuestion.map((subject) => {
                return (
                  <React.Fragment key={subject.name}>
                    {template.formState.examType === "model" && (
                      <p className="font-[500] text-[16px] leading-[125%] tracking-[-0.02em] text-[#49734F]">
                        {subject.name}
                      </p>
                    )}{" "}
                    {subject.qustionList.map((question, questionIndex) => {
                      if (question.type === "essay") {
                        return (
                          <EassayGradeTemplate
                            key={question.id}
                            number={questionIndex + 1}
                            question={question.text}
                            answer={
                              "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                            }
                            score={4}
                            maxMarks={question.points}
                          />
                        );
                      } else if (question.type === "objective") {
                        return (
                          <ObjectiveGradeTemplate
                            key={question.id}
                            number={questionIndex + 1}
                            question={question.text}
                            options={(question as any).options}
                            answer={(question as any).studentSelectedOptionId}
                            correctOptionId={(question as any).correctOptionId}
                            score={4}
                            maxMarks={question.points}
                          />
                        );
                      }
                      return null;
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          )}
          {openModal === "edit" && (
            <div className="flex flex-col gap-4 mt-4">
              {template.subjects.map((subject) => {
                const isModelTest = template.formState.examType === "model";
                const subjects = subject.name;

                return subject.questionSections.map((section) => {
                  let count = section.questions.filter((qus) => qus.showValidation).length;
                  let totalQuestions = section.questions.length;

                  if (totalQuestions === 0) return <></>;
                  return (
                    <>
                      <p className="font-[600] text-[24px] leading-[100%] tracking-[-0.02em] text-[#747775]">
                        {`${section.headerText} ${isModelTest ? `(${subjects})` : ""}`}
                      </p>
                      <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">
                        {`3 of ${section.questions.length} questions ${section.type === "objective" ? "auto" : ""} graded`}
                      </p>

                      {section.questions.map((question, questionIndex) => {
                        if (section.type === "essay") {
                          return (
                            <EassayGradeTemplate
                              key={question.id}
                              number={questionIndex + 1}
                              question={question.text}
                              answer={
                                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                              }
                              score={4}
                              maxMarks={question.points}
                            />
                          );
                        } else if (section.type === "objective") {
                          return (
                            <ObjectiveGradeTemplate
                              key={question.id}
                              number={questionIndex + 1}
                              question={question.text}
                              options={(question as any).options}
                              answer={(question as any).studentSelectedOptionId}
                              correctOptionId={(question as any).correctOptionId}
                              score={4}
                              maxMarks={question.points}
                            />
                          );
                        }
                      })}
                    </>
                  );
                });
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GradingModel;

const EassayGradeTemplate = ({
  number,
  question,
  answer,
  score,
  maxMarks,
}: {
  number: number;
  question: string;
  answer: string;
  score: number;
  maxMarks: number;
}) => {
  return (
    <div className="border border-[#E5E5E5] rounded-[8px] p-4 flex flex-col gap-4">
      <p className="font-[500] text-[16px] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
        {number}. {question}
      </p>
      <p className="font-[400] text-[16px] leading-[120%] tracking-[-0.02em] text-[#747775]">{answer}</p>
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <p className="font-[400] text-[14px] leading-[125%] tracking-[-0.02em] text-[#232A25]">Score</p>
          <div className="w-12 h-8 bg-[#EFF0F3] rounded-[2px] flex justify-center items-center">
            <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#232A25]">{score}</p>
          </div>
        </div>
        <p className="font-[400] text-[14px] leading-[125%] tracking-[-0.02em] text-[#747775]">
          Max marks: <span className="font-[500] ml-1">{maxMarks}</span>
        </p>
      </div>
    </div>
  );
};

const ObjectiveGradeTemplate = ({
  number,
  question,
  options,
  answer,
  score,
  maxMarks,
  correctOptionId,
}: {
  number: number;
  question: string;
  answer: string;
  score: number;
  options: {
    id: string;
    text: string;
    image: string | null;
  }[];
  maxMarks: number;
  correctOptionId: string;
}) => {
  const optionList = options.map((option) => {
    return {
      ...option,
      isRightAnswer: option.id === correctOptionId,
      isSelected: option.id === answer,
    };
  });
  return (
    <div className="border border-[#E5E5E5] rounded-[8px] p-4 flex flex-col gap-4">
      <p className="font-[500] text-[16px] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
        {number}. {question}
      </p>
      <div className="flex flex-col gap-2">
        {optionList.map((option) => {
          let isRightAnswer = option.isRightAnswer;
          let isCorrect = option.isRightAnswer && option.isSelected;
          let isWrong = !option.isRightAnswer && option.isSelected;

          let colorCode = isCorrect ? "#49734F" : isWrong ? "#D24B44" : "#232A25";
          return (
            <div className="flex gap-2" key={option.id}>
              {(isCorrect || isWrong) && (
                <div
                  className={`min-w-4 h-4 border rounded-full flex justify-center items-center`}
                  style={{ borderColor: colorCode }}
                >
                  <div
                    className={`w-3 h-3 rounded-full flex justify-center items-center`}
                    style={{ backgroundColor: colorCode }}
                  ></div>
                </div>
              )}
              {isRightAnswer && !isCorrect && !isWrong && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M8 16C3.5816 16 0 12.4184 0 8C0 3.5816 3.5816 0 8 0C12.4184 0 16 3.5816 16 8C16 12.4184 12.4184 16 8 16ZM7.0584 9.712L4.8464 7.4984L4 8.3448L6.4952 10.8416C6.64522 10.9916 6.84867 11.0758 7.0608 11.0758C7.27293 11.0758 7.47638 10.9916 7.6264 10.8416L12.388 6.0816L11.5384 5.232L7.0584 9.712Z"
                    fill="#49734F"
                  />
                </svg>
              )}
              {!isRightAnswer && !isWrong && !isWrong && (
                <div
                  className={`min-w-4 h-4 border rounded-full flex justify-center items-center border border-[#232A25]`}
                ></div>
              )}

              <p
                className="font-[400] text-[16px] leading-[16px] tracking-[-0.02em]"
                style={{ color: isWrong ? "#D24B44" : "#232A25" }}
              >
                {option.text}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <p className="font-[400] text-[14px] leading-[125%] tracking-[-0.02em] text-[#232A25]">Score</p>
          <div className="w-12 h-8 bg-[#EFF0F3] rounded-[2px] flex justify-center items-center">
            <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#232A25]">{score}</p>
          </div>
        </div>
        <div className="flex gap-1 items-center">
          <p className="mr-1 font-[400] text-[14px] leading-[125%] tracking-[-0.02em] text-[#232A25]">Your answer</p>
          {correctOptionId === answer ? (
            <>
              <svg
                className="mt-[2px]"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M8 16C3.5816 16 0 12.4184 0 8C0 3.5816 3.5816 0 8 0C12.4184 0 16 3.5816 16 8C16 12.4184 12.4184 16 8 16ZM7.0584 9.712L4.8464 7.4984L4 8.3448L6.4952 10.8416C6.64522 10.9916 6.84867 11.0758 7.0608 11.0758C7.27293 11.0758 7.47638 10.9916 7.6264 10.8416L12.388 6.0816L11.5384 5.232L7.0584 9.712Z"
                  fill="#49734F"
                />
              </svg>
              <p className="font-[500] text-[14px] leading-[16px] tracking-[-0.02em] text-[#49734F]">Correct</p>
            </>
          ) : (
            <>
              <svg
                className="mt-[2px]"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_495_19635)">
                  <path
                    d="M8 0C3.54286 0 0 3.54286 0 8C0 12.4571 3.54286 16 8 16C12.4571 16 16 12.4571 16 8C16 3.54286 12.4571 0 8 0ZM11.0857 12L8 8.91429L4.91429 12L4 11.0857L7.08571 8L4 4.91429L4.91429 4L8 7.08571L11.0857 4L12 4.91429L8.91429 8L12 11.0857L11.0857 12Z"
                    fill="#D24B44"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_495_19635">
                    <rect width="16" height="16" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <p className="font-[500] text-[14px] leading-[16px] tracking-[-0.02em] text-[#D24B44]">Incorrect</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const template = {
  currentStep: "Publish",
  formState: {
    examType: "model",
    testName: "Summer Model Test",
    duration: "40",
    passingScore: "30",
    allowNegativeMarking: true,
    negativeMarking: "25",
  },
  subjects: [
    {
      id: "1776062179661-ij9x736",
      name: "Mathematics",
      value: "math",
      questionSections: [
        {
          id: "1776062179661-6sj4ppl",
          type: "objective",
          headerText: "Objective Questions",
          questions: [
            {
              id: "1776062179661-2jrlhm1",
              text: "What is 2+2. slfj sdjfjsl fskdfjsjdfl ksdfj sdjklf sjfldjsklf sdfjsdlfjklsdjf sdjfklsdjlf sdkjfljsdlfk sdlkfjlksjf jsdlfjskldfj sdkjflksdjf sdjflds fklsdjf slkdfjsdl fjljsdfl sdjlfkjsdl fjsljflds f.",
              image: null,
              studentSelectedOptionId: "1776062217202-hrezlmx",
              options: [
                {
                  id: "1776062217202-hrezlmx",
                  text: "4",
                  image: null,
                },
                {
                  id: "1776062221006-qguebcc",
                  text: "2",
                  image: null,
                },
                {
                  id: "1776062223755-ys6xscq",
                  text: "3",
                  image: null,
                },
                {
                  id: "1776062226493-skldt8y",
                  text: "fjdskljf sdjkflksdj fjdslkfjlsd fjlsdjflk dsfkljdklf jdklsfjkldjfdksljf lkdsjfklsdjf lsdkjfklsdjfkl sdjklfj sdlkfjsdklfj dlsjflksdjfkl sedfjkldsjf sdjflsdkjf sdjkflksdjf lsdfjdlsf jdlskfjsldfj",
                  image: null,
                },
              ],
              correctOptionId: "1776062217202-hrezlmx",
              points: 4,
              showValidation: false,
            },
            {
              id: "1776062266599-uljru0z",
              text: "What is 2+2. slfj sdjfjsl fskdfjsjdfl ksdfj sdjklf sjfldjsklf sdfjsdlfjklsdjf sdjfklsdjlf sdkjfljsdlfk sdlkfjlksjf jsdlfjskldfj sdkjflksdjf sdjflds fklsdjf slkdfjsdl fjljsdfl sdjlfkjsdl fjsljflds f.",
              image: null,
              studentSelectedOptionId: "1776062266599-qv56t8y",
              options: [
                {
                  id: "1776062266599-qv56t8y",
                  text: "4",
                  image: null,
                },
                {
                  id: "1776062266599-idr32yh",
                  text: "2",
                  image: null,
                },
                {
                  id: "1776062266599-6kfye5d",
                  text: "3",
                  image: null,
                },
                {
                  id: "1776062266599-n2rykjq",
                  text: "fjdskljf sdjkflksdj fjdslkfjlsd fjlsdjflk dsfkljdklf jdklsfjkldjfdksljf lkdsjfklsdjf lsdkjfklsdjfkl sdjklfj sdlkfjsdklfj dlsjflksdjfkl sedfjkldsjf sdjflsdkjf sdjkflksdjf lsdfjdlsf jdlskfjsldfj",
                  image: null,
                },
              ],
              correctOptionId: "1776062266599-idr32yh",
              points: 4,
              showValidation: false,
            },
          ],
        },
        {
          id: "1776062179661-csq6wc7",
          type: "essay",
          headerText: "Essay Questions",
          questions: [
            {
              id: "1776062179661-1vk035p",
              text: "Explain pythagorus formula.",
              image: null,
              points: 4,
              showValidation: false,
            },
            {
              id: "1776062295160-79wq1ft",
              text: "Explain pythagorus formula. jksdfj jsdfjlsdf sdlfks dkfjlsdfj sldjfls dfjksdljfklsdjfklsdjf sjkdfjs dfjlsdkf jsdlkjfklsdjf lskdjflksdjflks dfjlksdjfl sdjflsdj flsdjf lksdfj lsdjflsdjflsd lsdkjflsdjf lsdj flsdjf lsjfl sdjlkfls lksdjflksdjf lsdkjfl sdjflsd flksdjflsd fjls",
              image: null,
              points: 4,
              showValidation: false,
            },
          ],
        },
      ],
    },
    {
      id: "1776062325384-0bbxwcv",
      name: "English",
      value: "english",
      questionSections: [
        {
          id: "1776062325384-t01ju74",
          type: "objective",
          headerText: "Objective Questions",
          questions: [
            {
              id: "1776062325384-htmfiqc",
              text: "When Robindranath Dies?",
              image: null,
              options: [
                {
                  id: "1776062338806-928a7vo",
                  text: "1988",
                  image: null,
                },
                {
                  id: "1776062342244-yhq7gdu",
                  text: "1985",
                  image: null,
                },
                {
                  id: "1776062345638-zzl2bfu",
                  text: "1974",
                  image: null,
                },
                {
                  id: "1776062349430-41iqbbr",
                  text: "1965",
                  image: null,
                },
              ],
              correctOptionId: "1776062342244-yhq7gdu",
              points: 4,
              showValidation: false,
            },
            {
              id: "1776062364115-qz79dkj",
              text: "When nazrul die? sldkfj lsdjfl lsdjf lsldjf lsdjk sldjf sl dfjlsd lsdkjf sls dfjldsj lsdkfj sldlsdjflsdj lsdjf lsl skdjf sl lsdfj lsdjfls l lsdjflsd lsdjfls lsjd f.",
              image: null,
              options: [
                {
                  id: "1776062389706-kwobmey",
                  text: "1788",
                  image: null,
                },
                {
                  id: "1776062393266-xfm5og0",
                  text: "1744",
                  image: null,
                },
                {
                  id: "1776062395932-efu9hxm",
                  text: "1755",
                  image: null,
                },
                {
                  id: "1776062399300-217hj9l",
                  text: "fdslkjf lskjdlfj lsjdf kjs fksdjfl lsdjfl sljflsj lsd flksjdlf lsjd fljsd fls sldjfl sdjlf sldjfl sfjls",
                  image: null,
                },
              ],
              correctOptionId: "1776062393266-xfm5og0",
              points: 2,
              showValidation: false,
            },
          ],
        },
        {
          id: "1776062325384-12b5sfm",
          type: "essay",
          headerText: "Essay Questions",
          questions: [
            {
              id: "1776062325384-bxxwgao",
              text: "Who is robindronath?",
              image: null,
              points: 2,
              showValidation: false,
            },
            {
              id: "1776062439797-dboo1ex",
              text: "sdf s sdlkjfl lsdjfl l sldkjfl ls dlfjl lsdjf sjl lsdjfl sl lsdkjflsj ls lsjdfljsl f sldjflsj lsdjf lsj lsjf ljsl ls lfsjdlfj sljflsdj flsl sldjf lsdjf l sdljflsdjf lsd flsjdf  sljdfllsdf l sldjfl sdlf sjdfl sdflj sl.",
              image: null,
              points: 2,
              showValidation: false,
            },
          ],
        },
      ],
    },
  ],
  activeSubjectId: "1776062325384-0bbxwcv",
  activeQuestionId: "1776062439797-dboo1ex",
  pendingFocusQuestion: null,
  pendingFocusOption: null,
  dragState: null,
  publishState: {
    publishTiming: "immediately",
    scheduleAt: "2026-04-12T22:16:52.627Z",
    endingAt: "2026-04-15T19:16:52.627Z",
    testAudience: "anyone",
    selectedClassId: "",
    excluded_students: [],
  },
};
