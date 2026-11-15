"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { RichTextContent, RichTextEditor } from "@/component/RichTextEditor";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, ConfirmDialog, Drawer, ErrorState, FileDrop, Input, PageHeader, RadioGroup, Skeleton, StatusPill, Tabs, type BadgeTone } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { uploadMedia } from "@/utils/media/uploadMedia";
import GroupDrawer from "./GroupDrawer";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;
const STATUS_TONE: Record<IeltsTestStatus, BadgeTone> = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "warning" };
const fileUrl = (id: string) => `${BASE}/files/${id}/content`;

/**
 * The IELTS test builder (P10-03, IEL-03): one tab per module, each part with its text,
 * recording or picture and its question groups numbered 1–40; publish says what is missing.
 * Published tests are read-only until moved back to drafts.
 */
const IeltsTestBuilder = ({ testId }: { testId: string }) => {
  const t = useTranslations("ieltsBuilder");
  const tt = useTranslations("ieltsTests");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const router = useRouter();
  const { data: test, failed, reload, setData } = useApiData<IeltsTest>(`/ielts/tests/${testId}`);
  const [problems, setProblems] = useState<IeltsTestProblem[]>([]);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  if (failed !== null) return <ErrorState title={failed === 404 ? t("notFound") : failed === 403 ? tt("notAvailable") : t("loadFailed")} onRetry={reload} />;
  if (!test) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={8} />
      </Card>
    );
  }
  const editable = test.can_edit && test.status === "DRAFT";

  const run = async (path: string, done: string, after?: (next: IeltsTest) => void) => {
    setBusy(true);
    try {
      const res = await axiosReq.post<{ payload: IeltsTest }>(`${BASE}/ielts/tests/${test.id}/${path}`);
      setProblems([]);
      if (after) after(res.data.payload);
      else setData(res.data.payload);
      triggerToast({ title: done, type: "success" });
    } catch (err) {
      const error = err as AxiosError<ApiError & { code?: string; details?: { problems?: IeltsTestProblem[] } }>;
      if (error.response?.data?.code === "IELTS_TEST_INCOMPLETE") setProblems(error.response.data.details?.problems ?? []);
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const modules = test.modules.map((module) => ({
    key: module,
    label: tt(`modulesShort.${module}`),
    content: (
      <div className="flex flex-col gap-6">
        {test.parts
          .filter((p) => p.module === module)
          .map((part) => (
            <PartCard key={part.id} test={test} part={part} editable={editable} onSaved={setData} />
          ))}
      </div>
    ),
  }));

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={test.title}
        description={`${tt(`purposes.${test.purpose}`)} · ${tt(`types.${test.test_type}`)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[test.status]}>{tt(`statuses.${test.status}`)}</StatusPill>
            {test.can_edit ? (
              <Button variant="secondary" onClick={() => setDetails(true)}>
                {t("details")}
              </Button>
            ) : null}
            {test.can_edit && test.status === "DRAFT" ? (
              <Button loading={busy} onClick={() => void run("publish", t("published"))}>
                {t("publish")}
              </Button>
            ) : null}
            {test.can_edit && test.status !== "DRAFT" ? (
              <Button variant="secondary" loading={busy} onClick={() => void run("unpublish", t("movedToDrafts"))}>
                {t("moveToDrafts")}
              </Button>
            ) : null}
            <Button variant="ghost" disabled={busy} onClick={() => void run("duplicate", tt("copied"), (copy) => router.push(`/ielts/tests/${copy.id}`))}>
              {tt("copy")}
            </Button>
          </div>
        }
      />
      {test.needs_review ? <p className="text-body-sm text-warning">{tt("needsReview")}</p> : null}
      {!editable ? <p className="text-body-sm text-ink-muted">{test.can_edit ? t("lockedPublished") : t("lockedNotYours")}</p> : null}
      {problems.length ? (
        <Card>
          <h2 className="mb-2 text-body font-semibold text-ink">{t("notReady")}</h2>
          <ul className="list-disc ps-5 text-body-sm text-ink" aria-label={t("notReady")}>
            {problems.map((p, i) => (
              <li key={i}>
                {p.part_no === null
                  ? t("problems.NOT_40", { module: tt(`modulesShort.${p.module}`), count: p.count ?? 0 })
                  : t(`problems.${p.problem}` as "problems.NO_TEXT", { part: tt(`partNames.${p.module}`, { no: p.part_no }), module: tt(`modulesShort.${p.module}`) })}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Tabs tabs={modules} />
      {details ? <DetailsDrawer test={test} onClose={() => setDetails(false)} onSaved={(next) => (setData(next), setDetails(false))} /> : null}
    </div>
  );
};

/** A part: title, text or recording, picture, and (Listening / Reading) its question groups. */
const PartCard = ({ test, part, editable, onSaved }: { test: IeltsTest; part: IeltsPart; editable: boolean; onSaved: (test: IeltsTest) => void }) => {
  const t = useTranslations("ieltsBuilder");
  const tt = useTranslations("ieltsTests");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [title, setTitle] = useState(part.title ?? "");
  const [content, setContent] = useState(part.content ?? "");
  const [uploading, setUploading] = useState<{ kind: "audio" | "image"; progress: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<IeltsGroup | "new" | null>(null);
  const [removing, setRemoving] = useState<IeltsGroup | null>(null);
  const hasGroups = part.module === "LISTENING" || part.module === "READING";
  const hasPicture = part.module === "READING" || part.module === "WRITING";

  const send = async (request: () => Promise<{ data: { payload: IeltsTest } }>, done: string) => {
    setBusy(true);
    try {
      const res = await request();
      onSaved(res.data.payload);
      triggerToast({ title: done, type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const savePart = (change: Record<string, unknown>) => send(() => axiosReq.put(`${BASE}/ielts/tests/${test.id}/parts/${part.id}`, change), t("partSaved"));

  const upload = async (kind: "audio" | "image", files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading({ kind, progress: 0 });
    try {
      const uploaded = await uploadMedia("ielts", file, undefined, { onProgress: (progress) => setUploading({ kind, progress }) });
      await savePart(kind === "audio" ? { audio_file_id: uploaded.id } : { image_file_id: uploaded.id });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setUploading(null);
    }
  };

  const move = (index: number, by: -1 | 1) => {
    const ids = part.groups.map((g) => g.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    void send(() => axiosReq.put(`${BASE}/ielts/tests/${test.id}/parts/${part.id}/groups/order`, { group_ids: ids }), t("orderSaved"));
  };

  const numbers = (from: number | null, to: number | null) => (from === null || to === null ? t("noQuestionsYet") : from === to ? t("questionNumber", { from }) : t("questionRange", { from, to }));

  return (
    <Card>
      <section aria-label={tt(`partNames.${part.module}`, { no: part.part_no })} className="flex flex-col gap-4">
        <h2 className="text-title-sm font-semibold text-ink">{tt(`partNames.${part.module}`, { no: part.part_no })}</h2>
        {editable ? (
          <>
            <Input label={t("partTitle")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            {part.module !== "LISTENING" ? (
              <div className="flex flex-col gap-1">
                <span className="text-body-sm font-medium text-ink">{t(`contentLabel.${part.module}`)}</span>
                <RichTextEditor value={content} onChange={setContent} variant="lite" minHeightClassName="min-h-[160px]" placeholder={t(`contentHint.${part.module}`)} />
              </div>
            ) : null}
            <div>
              <Button size="sm" variant="secondary" loading={busy} onClick={() => void savePart({ title: title.trim() || null, ...(part.module !== "LISTENING" ? { content: content || null } : {}) })}>
                {t("savePart")}
              </Button>
            </div>
          </>
        ) : (
          <>
            {part.title ? <p className="font-medium text-ink">{part.title}</p> : null}
            {part.content ? <RichTextContent html={part.content} /> : null}
          </>
        )}

        {part.module === "LISTENING" ? (
          <div className="flex flex-col gap-2">
            {part.audio_file_id ? (
              <audio controls preload="none" src={fileUrl(part.audio_file_id)} aria-label={t("recording")} className="w-full" />
            ) : (
              <p className="text-body-sm text-ink-muted">{t("noRecording")}</p>
            )}
            {editable ? (
              <FileDrop
                label={part.audio_file_id ? t("replaceRecording") : t("addRecording")}
                onFiles={(files) => void upload("audio", files)}
                items={uploading?.kind === "audio" ? [{ id: "audio", name: t("uploading"), progress: uploading.progress }] : []}
                accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav"
                acceptLabel={t("audioTypes")}
                maxSizeMb={20}
              />
            ) : null}
          </div>
        ) : null}

        {hasPicture ? (
          <div className="flex flex-col gap-2">
            {part.image_file_id ? <Image src={fileUrl(part.image_file_id)} alt={t("picture")} width={0} height={0} sizes="100vw" unoptimized className="h-auto max-h-64 w-auto self-start rounded-card border border-border" /> : null}
            {editable ? (
              <div className="flex flex-wrap items-end gap-2">
                <FileDrop
                  label={part.image_file_id ? t("replacePicture") : t("addPicture")}
                  onFiles={(files) => void upload("image", files)}
                  items={uploading?.kind === "image" ? [{ id: "image", name: t("uploading"), progress: uploading.progress }] : []}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  acceptLabel={t("imageTypes")}
                  maxSizeMb={20}
                  className="flex-1"
                />
                {part.image_file_id ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void savePart({ image_file_id: null })}>
                    {t("removePicture")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasGroups ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-body font-semibold text-ink">{t("groups")}</h3>
            {part.groups.length === 0 ? <p className="text-body-sm text-ink-muted">{t("noGroups")}</p> : null}
            <ol className="flex flex-col gap-3" aria-label={t("groupsOf", { part: tt(`partNames.${part.module}`, { no: part.part_no }) })}>
              {part.groups.map((group, i) => (
                <li key={group.id} className="rounded-card border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-body-sm font-semibold text-ink">{numbers(group.number_from, group.number_to)}</span>
                      <Badge tone="info">{t(`groupTypes.${group.type}` as "groupTypes.SHORT_ANSWER")}</Badge>
                      <span className="text-body-sm text-ink-muted">{group.instruction}</span>
                    </div>
                    {editable ? (
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t("moveUp", { n: i + 1 })}>
                          {t("up")}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy || i === part.groups.length - 1} onClick={() => move(i, 1)} aria-label={t("moveDown", { n: i + 1 })}>
                          {t("down")}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(group)} aria-label={t("editGroupN", { n: i + 1 })}>
                          {t("edit")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(group)} aria-label={t("removeGroupN", { n: i + 1 })}>
                          {t("remove")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <ul className="mt-2 flex flex-col gap-1 text-body-sm text-ink">
                    {group.questions.map((q) => (
                      <li key={q.id}>
                        <span className="font-medium">{q.number_from === q.number_to ? q.number_from : `${q.number_from}–${q.number_to}`}.</span> {q.prompt ?? ""}{" "}
                        <span className="text-ink-muted">→ {"keys" in q.answer ? q.answer.keys.join(", ") : q.answer.accepted.join(" / ")}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            {editable ? (
              <div>
                <Button size="sm" onClick={() => setEditing("new")}>
                  {t("addGroup")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {editing ? (
        <GroupDrawer
          test={test}
          part={part}
          group={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            onSaved(next);
            setEditing(null);
            triggerToast({ title: t("groupSaved"), type: "success" });
          }}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title={t("removeGroupTitle")}
        description={t("removeGroupDescription")}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        tone="danger"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const group = removing;
          setRemoving(null);
          if (group) void send(() => axiosReq.delete(`${BASE}/ielts/tests/${test.id}/groups/${group.id}`), t("groupRemoved"));
        }}
      />
    </Card>
  );
};

/** Title any time; test type and minutes per module while a draft. */
const DetailsDrawer = ({ test, onClose, onSaved }: { test: IeltsTest; onClose: () => void; onSaved: (test: IeltsTest) => void }) => {
  const t = useTranslations("ieltsBuilder");
  const tt = useTranslations("ieltsTests");
  const format = useFormat();
  const { handleError } = useApiError();
  const draft = test.status === "DRAFT";
  const [title, setTitle] = useState(test.title);
  const [testType, setTestType] = useState<IeltsTestType>(test.test_type);
  const [minutes, setMinutes] = useState<Partial<Record<IeltsModule, string>>>(
    Object.fromEntries(test.modules.map((m) => [m, String(Math.round((test.durations[m] ?? 0) / 60))])),
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await axiosReq.patch<{ payload: IeltsTest }>(`${BASE}/ielts/tests/${test.id}`, {
        title: title.trim(),
        ...(draft ? { test_type: testType, durations: Object.fromEntries(test.modules.map((m) => [m, Number(minutes[m] || 0) * 60])) } : {}),
      });
      onSaved(res.data.payload);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("details")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} disabled={!title.trim()} onClick={() => void save()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Input label={tt("title")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        {draft ? (
          <>
            <RadioGroup
              legend={tt("testType")}
              name="ielts-details-type"
              inline
              value={testType}
              onChange={(value) => setTestType(value as IeltsTestType)}
              options={(["ACADEMIC", "GENERAL"] as const).map((v) => ({ value: v, label: tt(`types.${v}`) }))}
            />
            {test.modules.map((m) => (
              <Input
                key={m}
                type="number"
                min={1}
                max={180}
                label={t("minutesFor", { module: tt(`modulesShort.${m}`) })}
                hint={m === "LISTENING" ? t("listeningReview") : undefined}
                value={minutes[m] ?? ""}
                onChange={(e) => setMinutes({ ...minutes, [m]: e.target.value })}
              />
            ))}
          </>
        ) : (
          <p className="text-body-sm text-ink-muted">
            {test.modules.map((m) => `${tt(`modulesShort.${m}`)} ${format.number(Math.round((test.durations[m] ?? 0) / 60))}`).join(" · ")}
          </p>
        )}
      </div>
    </Drawer>
  );
};

export default IeltsTestBuilder;
