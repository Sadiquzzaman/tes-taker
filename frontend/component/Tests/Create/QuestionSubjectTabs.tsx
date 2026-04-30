import PlusIcon from "@/component/svg/PlusIcon";
import CrossIconSVG from "@/component/svg/CrossIconSVG";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import AddQuestionSubjectModal from "./AddQuestionSubjectModal";
import RemoveSubjectConfirmationModal from "./RemoveSubjectConfirmationModal";

type QuestionSubjectTabsProps = {
  subjects: SubjectItem[];
  activeSubjectId: string | null;
  availableSubjectOptions: Array<{ id: string; label: string; value: string }>;
  onSelectSubject: (subjectId: string) => void;
  onAddSubject: (subject: { id: string; label: string; value: string }) => void;
  onRemoveSubject: (subjectId: string) => void;
};

const QuestionSubjectTabs = memo(
  ({
    subjects,
    activeSubjectId,
    availableSubjectOptions,
    onSelectSubject,
    onAddSubject,
    onRemoveSubject,
  }: QuestionSubjectTabsProps) => {
    const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
    const [subjectPendingRemoval, setSubjectPendingRemoval] = useState<Pick<SubjectItem, "id" | "name"> | null>(null);
    const subjectScrollRef = useRef<HTMLDivElement>(null);
    const subjectButtonRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const isSubjectScrollDragging = useRef(false);
    const subjectScrollStartX = useRef(0);
    const subjectScrollStartLeft = useRef(0);

    useEffect(() => {
      const scrollContainer = subjectScrollRef.current;

      if (!activeSubjectId || !scrollContainer) {
        return;
      }

      const activeButton = subjectButtonRefs.current[activeSubjectId];

      if (!activeButton) {
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const buttonScrollLeft = scrollContainer.scrollLeft + buttonRect.left - containerRect.left;
      const scrollTarget = buttonScrollLeft - scrollContainer.clientWidth / 2 + buttonRect.width / 2;
      scrollContainer.scrollTo({ left: scrollTarget, behavior: "smooth" });
    }, [activeSubjectId]);

    const handleSubjectScrollMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      const element = subjectScrollRef.current;

      if (!element) {
        return;
      }

      isSubjectScrollDragging.current = true;
      subjectScrollStartX.current = event.clientX;
      subjectScrollStartLeft.current = element.scrollLeft;
      element.style.cursor = "grabbing";
      element.style.userSelect = "none";
    }, []);

    const handleSubjectScrollMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      if (!isSubjectScrollDragging.current || !subjectScrollRef.current) {
        return;
      }

      const deltaX = event.clientX - subjectScrollStartX.current;
      subjectScrollRef.current.scrollLeft = subjectScrollStartLeft.current - deltaX;
    }, []);

    const handleSubjectScrollMouseUp = useCallback(() => {
      if (!subjectScrollRef.current) {
        return;
      }

      isSubjectScrollDragging.current = false;
      subjectScrollRef.current.style.cursor = "";
      subjectScrollRef.current.style.userSelect = "";
    }, []);

    const handleConfirmRemoveSubject = useCallback(() => {
      if (!subjectPendingRemoval) {
        return;
      }

      onRemoveSubject(subjectPendingRemoval.id);
      setSubjectPendingRemoval(null);
    }, [onRemoveSubject, subjectPendingRemoval]);

    return (
      <>
        <div className="flex w-fit max-w-full items-center gap-2 rounded-[6px] bg-[#EFF0F3] h-10 p-1">
          <div
            ref={subjectScrollRef}
            className="flex min-w-0 items-center gap-2 overflow-x-auto h-full scrollbar-hide cursor-grab"
            onMouseDown={handleSubjectScrollMouseDown}
            onMouseMove={handleSubjectScrollMouseMove}
            onMouseUp={handleSubjectScrollMouseUp}
            onMouseLeave={handleSubjectScrollMouseUp}
          >
            {subjects.map((subject) => {
              const isActiveSubject = subject.id === activeSubjectId;

              return (
                <div
                  key={subject.id}
                  ref={(node) => {
                    subjectButtonRefs.current[subject.id] = node;
                  }}
                  onClick={() => onSelectSubject(subject.id)}
                  className={`rounded-[4px] h-full flex-shrink-0 flex items-center justify-center px-3 text-[14px] font-[400] leading-[16px] tracking-[-0.02em] whitespace-nowrap ${
                    isActiveSubject ? "bg-[#49734F] text-white" : "bg-white text-[#232A25]"
                  }`}
                >
                  {subject.name}
                  <button
                    type="button"
                    className={`ml-2 flex h-4 w-4 items-center justify-center rounded-full border ${
                      isActiveSubject ? "border-white/40 text-white" : "border-[#D0D5DD] text-[#747775]"
                    }`}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSubjectPendingRemoval({ id: subject.id, name: subject.name });
                    }}
                    aria-label={`Remove ${subject.name} subject`}
                  >
                    <CrossIconSVG />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setIsAddSubjectModalOpen(true)}
            className="flex flex-shrink-0 items-center justify-center px-1 text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25] whitespace-nowrap"
          >
            <PlusIcon />
            <span className="ml-1">Add Subject</span>
          </button>
        </div>

        <AddQuestionSubjectModal
          open={isAddSubjectModalOpen}
          onClose={() => setIsAddSubjectModalOpen(false)}
          onSelect={(subject) => {
            onAddSubject(subject);
            setIsAddSubjectModalOpen(false);
          }}
          subjectOptions={availableSubjectOptions}
        />

        <RemoveSubjectConfirmationModal
          open={Boolean(subjectPendingRemoval)}
          subjectName={subjectPendingRemoval?.name ?? ""}
          onClose={() => setSubjectPendingRemoval(null)}
          onConfirm={handleConfirmRemoveSubject}
        />
      </>
    );
  },
);

QuestionSubjectTabs.displayName = "QuestionSubjectTabs";

export default QuestionSubjectTabs;
