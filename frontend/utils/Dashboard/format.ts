export function formatRemainingTime(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatExamDuration(minutes: number | null): string {
  if (!minutes) {
    return "—";
  }
  if (minutes < 60) {
    return `${minutes} m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${String(hours).padStart(2, "0")} h`;
  }
  return `${String(hours).padStart(2, "0")} h, ${remainingMinutes} m`;
}

export function formatExamStart(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatAvgScore(percent: number | null): string {
  if (percent == null) {
    return "—";
  }
  return `${Math.round(percent)}%`;
}
