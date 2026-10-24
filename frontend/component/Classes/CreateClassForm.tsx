"use client";

import NormalInput from "@/Ui/NormalInput";
import ImportantIconSVG from "../svg/ImportantIconSvg";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import TagInput from "@/Ui/TagInput";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import Link from "next/link";
import ButtonLoader from "../Loader/ButtonLoadder";
import useCreateClassForm from "@/hooks/classes/useCreateClassForm";

const CreateClassForm = () => {
  const {
    createClassPayload,
    setCreateClassPayload,
    value,
    setValue,
    loading,
    fileInputRef,
    tagInputRef,
    invalidStudentIndices,
    addTag,
    removeTag,
    handleTagClick,
    handleCsvUpload,
    handleDownloadTemplate,
    handleCreateClass,
    isIndividual,
  } = useCreateClassForm();
  const classesHref = isIndividual ? "/classes" : "/organization/classes";

  return (
    <>
      <div className="w-ful my-2 py-2 sm:my-4 sm:py-4 border-b border-border flex flex-col gap-2">
        <p className={`font-normal text-body-sm text-ink-muted`}>Step 1</p>
        <p className={`font-semibold text-title tracking-tight text-ink-muted`}>Class details</p>
      </div>
      <div className="w-ful flex flex-col gap-2">
        <p className={`font-medium text-body text-ink`}>Class name</p>
        <NormalInput
          value={createClassPayload.class_name}
          onChange={(e) => setCreateClassPayload((prev) => ({ ...prev, class_name: e.target.value }))}
          parentClassName="w-full border-border rounded-input h-[44px]"
          inputClassName="text-body font-normal placeholder:text-ink-muted px-2"
          placeholder="e.g., Class 9A - Mathematics"
          afterIcon={null}
        />
      </div>
      <div className="w-ful flex flex-col gap-2 mt-4">
        <p className={`font-medium text-body text-ink`}>
          Class description (Optional)
        </p>
        <NormalInput
          value={createClassPayload.description}
          onChange={(e) => setCreateClassPayload((prev) => ({ ...prev, description: e.target.value }))}
          parentClassName="w-full border-border rounded-input h-[44px]"
          inputClassName="text-body font-normal placeholder:text-ink-muted px-2"
          placeholder="e.g., This class is for 9th grade mathematics"
          afterIcon={null}
        />
      </div>
      <div className="w-ful my-2 py-2 sm:my-4 sm:py-4 border-b border-border flex flex-col gap-2">
        <p className={`font-normal text-body-sm text-ink-muted`}>Step 2</p>
        <p className={`font-semibold text-title tracking-tight text-ink-muted`}>Add students</p>
      </div>
      <div className="w-ful flex flex-col gap-2">
        <p
          className={`font-medium text-body text-ink flex items-center gap-1`}
        >
          Student email or phone (Optional) <ImportantIconSVG />{" "}
        </p>
        <TagInput
          placeholder="Enter student email, phone, or Student ID"
          inputClassName="px-2"
          afterIcon={null}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          tags={createClassPayload.student_ids}
          removeTag={removeTag}
          addTag={addTag}
          invalidTagIndices={invalidStudentIndices}
          onTagClick={handleTagClick}
          inputRef={tagInputRef}
        />
      </div>
      <div className="flex flex-col gap-3 mt-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex flex-col gap-2">
          <p className={`font-normal text-body text-ink-muted`}>
            Invite by single/bulk email or phone. You can always add students later.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-[32px] rounded-lg border border-border px-3 text-sm font-medium text-ink"
            >
              Upload CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="h-[32px] rounded-lg border border-border px-3 text-sm font-medium text-primary"
            >
              Download demo Excel
            </button>
          </div>
          {invalidStudentIndices.length > 0 && (
            <p className="text-caption text-danger">
              Invalid items are highlighted in red. Click one to edit it.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={addTag}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 w-[71px] h-[32px] ${
            value.trim() === "" ? "bg-ink-muted" : "bg-ink"
          } rounded-lg text-ink-inverse text-sm font-medium capitalize`}
        >
          <HumanAddIconSVG />
          Add
        </button>
      </div>
      <div className="flex justify-end items-center gap-2 sm:gap-4 mt-6">
        <Link
          href={classesHref}
          className={`px-4 h-10 flex items-center justify-center rounded-input text-body-sm font-medium ${
            loading ? "bg-ink-muted" : "bg-canvas"
          } text-ink`}
        >
          Cancel
        </Link>
        <button
          onClick={handleCreateClass}
          disabled={loading}
          className={`px-4 h-10 flex items-center justify-center rounded-input text-body-sm font-medium ${
            loading ? "bg-ink-muted" : "bg-primary"
          } text-ink-inverse`}
        >
          <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
          {loading ? "Creating..." : "Create Class"}
          <RightArrowIconSVG />
        </button>
      </div>
    </>
  );
};

export default CreateClassForm;
