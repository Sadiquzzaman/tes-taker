import PlusIcon from "@/component/svg/PlusIcon";
import CrossIconSVG from "@/component/svg/CrossIconSVG";
import { useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button, cn, focusRing } from "@/design/ui";
import AddQuestionSubjectModal from "./AddQuestionSubjectModal";
import RemoveSubjectConfirmationModal from "./RemoveSubjectConfirmationModal";

const QuestionSubjectTabs = memo(
  ({
    subjects,
    activeSubjectId,
    availableSubjectOptions,
    onSelectSubject,
    onAddSubject,
    onRemoveSubject,
  }: QuestionSubjectTabsProps) => {
    const t = useTranslations("createTest.subjects");
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
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <div
            ref={subjectScrollRef}
            role="tablist"
            aria-label={t("label")}
            className="scrollbar-hide flex min-w-0 items-center gap-1 overflow-x-auto rounded-input bg-canvas p-1"
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
                  className={cn(
                    "flex h-8 shrink-0 items-center rounded-sm text-body-sm",
                    isActiveSubject ? "bg-primary text-ink-inverse" : "bg-surface text-ink",
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActiveSubject}
                    onClick={() => onSelectSubject(subject.id)}
                    className={cn("h-full whitespace-nowrap rounded-sm pl-3 pr-1", focusRing)}
                  >
                    {subject.name}
                  </button>
                  <button
                    type="button"
                    className={cn("mr-1 flex size-5 items-center justify-center rounded-full", isActiveSubject ? "hover:bg-primary-hover" : "text-ink-muted hover:bg-canvas", focusRing)}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => setSubjectPendingRemoval({ id: subject.id, name: subject.name })}
                    aria-label={t("remove", { name: subject.name })}
                  >
                    <CrossIconSVG />
                  </button>
                </div>
              );
            })}
          </div>
          <Button variant="secondary" size="sm" leftIcon={<PlusIcon />} onClick={() => setIsAddSubjectModalOpen(true)}>
            {t("add")}
          </Button>
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
