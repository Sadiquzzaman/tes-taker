export type ProctoringEventRecord = {
  id: string;
  type: string;
  message: string;
  points?: number;
  timestamp: string;
  source?: 'socket' | 'rest' | 'client';
};

export const parseProctoringEvents = (raw?: string | null): ProctoringEventRecord[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProctoringEventRecord[]) : [];
  } catch {
    return [];
  }
};

export const serializeProctoringEvents = (events: ProctoringEventRecord[]): string =>
  JSON.stringify(events);

export const appendProctoringEvent = (
  raw: string | null | undefined,
  event: ProctoringEventRecord,
  maxEvents = 500,
): string => {
  const events = parseProctoringEvents(raw);
  events.push(event);
  if (events.length > maxEvents) {
    return serializeProctoringEvents(events.slice(events.length - maxEvents));
  }
  return serializeProctoringEvents(events);
};

export const summarizeProctoringEvents = (events: ProctoringEventRecord[]) => {
  const byType: Record<string, number> = {};
  let totalPoints = 0;
  for (const event of events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1;
    totalPoints += Number(event.points ?? 0);
  }
  return {
    total_violations: events.length,
    total_red_flag_points: totalPoints,
    counts_by_type: byType,
  };
};
