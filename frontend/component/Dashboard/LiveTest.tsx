"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, IconButton, StatusPill } from "@/design/ui";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";
import TodayTile from "./TodayTile";

/** Today strip: tests running now, one at a time, with a live countdown and how many have submitted. */
const LiveTest = () => {
  const t = useTranslations("dashboard");
  const format = useFormat();
  const { data, loading } = useDashboard();
  const liveTests = data?.live_tests ?? [];
  const [index, setIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Go back to the first test whenever the number of live tests changes.
  const [indexedLength, setIndexedLength] = useState(liveTests.length);
  if (indexedLength !== liveTests.length) {
    setIndexedLength(liveTests.length);
    setIndex(0);
  }

  const currentTest = liveTests[index] ?? null;

  // Restart the countdown from the server value when the shown test or its remaining time changes.
  const countdownKey = currentTest ? `${currentTest.id}:${currentTest.remaining_seconds}` : null;
  const [shownCountdownKey, setShownCountdownKey] = useState<string | null>(null);
  if (shownCountdownKey !== countdownKey) {
    setShownCountdownKey(countdownKey);
    if (currentTest) {
      setRemainingSeconds(currentTest.remaining_seconds);
    }
  }

  // Tick once a second; restart when a different test (or a new server time) is shown.
  useEffect(() => {
    if (!countdownKey) {
      return;
    }
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdownKey]);

  const step = (delta: number) => setIndex((prev) => (prev + delta + liveTests.length) % liveTests.length);

  const pager =
    liveTests.length > 1 ? (
      <div className="flex items-center gap-1">
        <IconButton size="sm" label={t("today.previousLive")} icon={<ChevronLeftIcon />} onClick={() => step(-1)} />
        <span className="text-caption text-ink-muted">{t("today.liveOf", { current: index + 1, total: liveTests.length })}</span>
        <IconButton size="sm" label={t("today.nextLive")} icon={<ChevronRightIcon />} onClick={() => step(1)} />
      </div>
    ) : null;

  if (!currentTest) {
    return (
      <TodayTile
        label={t("today.liveNow")}
        loading={loading}
        value={format.number(0)}
        detail={t("today.noLive")}
        action={{ label: t("createTest"), href: "/tests/create" }}
      />
    );
  }

  return (
    <TodayTile label={t("today.liveNow")} loading={loading} headerExtra={pager}>
      <div className="flex items-center gap-2">
        <StatusPill tone="success">{t("today.timeLeft", { time: format.clock(remainingSeconds) })}</StatusPill>
      </div>
      <p className="truncate text-title-sm font-semibold text-ink">{currentTest.test_name ?? t("untitledTest")}</p>
      <p className="truncate text-body-sm text-ink-muted">{currentTest.class_name ?? t("noClass")}</p>
      <p className="mt-auto text-body-sm text-ink">
        {t("today.participants", { count: currentTest.participant_count })}
        {" · "}
        {t("today.submitted", { count: currentTest.submitted_count })}
      </p>
    </TodayTile>
  );
};

export default LiveTest;
