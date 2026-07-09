import type {
  Alignment,
  TimeOfDayDef,
  TimeOfDayId,
  TimeOfDaySchedule,
} from "./types";

export const TIME_OF_DAY_DEFS: Record<TimeOfDayId, TimeOfDayDef> = {
  dawn: { id: "dawn", alignmentModifier: {} },
  morning: { id: "morning", alignmentModifier: { lawful: 25, chaotic: -25 } },
  afternoon: { id: "afternoon", alignmentModifier: { lawful: 25, chaotic: -25 } },
  dusk: { id: "dusk", alignmentModifier: {} },
  first_watch: { id: "first_watch", alignmentModifier: { lawful: -25, chaotic: 25 } },
  second_watch: { id: "second_watch", alignmentModifier: { lawful: -25, chaotic: 25 } },
};

export const STANDARD_CYCLE: TimeOfDaySchedule = {
  id: "standard_cycle",
  phases: [
    { timeOfDay: "dawn", turns: 1 },
    { timeOfDay: "morning", turns: 1 },
    { timeOfDay: "afternoon", turns: 1 },
    { timeOfDay: "dusk", turns: 1 },
    { timeOfDay: "first_watch", turns: 1 },
    { timeOfDay: "second_watch", turns: 1 },
  ],
};

export const SCHEDULES: Record<string, TimeOfDaySchedule> = {
  standard_cycle: STANDARD_CYCLE,
};

// ロード時に一度だけ展開しておく(毎回計算し直さない)
export function expandSchedule(schedule: TimeOfDaySchedule): TimeOfDayId[] {
  return schedule.phases.flatMap((p) =>
    Array(p.turns).fill(p.timeOfDay) as TimeOfDayId[],
  );
}

const expandedCache = new Map<string, TimeOfDayId[]>();

function expandedById(scheduleId: string): TimeOfDayId[] {
  let expanded = expandedCache.get(scheduleId);
  if (!expanded) {
    const schedule = SCHEDULES[scheduleId];
    if (!schedule) throw new Error(`unknown schedule: ${scheduleId}`);
    expanded = expandSchedule(schedule);
    expandedCache.set(scheduleId, expanded);
  }
  return expanded;
}

// 時刻は状態として保存せず、ターン数から決定的に算出する(純粋関数)
export function getCurrentTimeOfDay(
  expandedSchedule: TimeOfDayId[],
  startIndex: number,
  turnNumber: number,
): TimeOfDayId {
  const index = (startIndex + turnNumber) % expandedSchedule.length;
  return expandedSchedule[index];
}

// turnNumber は 1 始まりのため、turnNumber=1 && startIndex=0 で先頭フェーズになるよう -1 する
export function timeOfDayForTurn(
  scheduleId: string,
  startIndex: number,
  turnNumber: number,
): TimeOfDayDef {
  const id = getCurrentTimeOfDay(expandedById(scheduleId), startIndex, turnNumber - 1);
  return TIME_OF_DAY_DEFS[id];
}

export function alignmentMultiplier(
  alignment: Alignment,
  timeOfDay: TimeOfDayDef,
): number {
  const modifier = timeOfDay.alignmentModifier[alignment] ?? 0;
  return 1 + modifier / 100;
}
